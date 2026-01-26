import { prisma } from "../config/prisma.js";
import asyncHandler from "../middlewares/asyncHandler.js";
import AppError from "../utils/AppError.js";

import redis from "../config/redis.js";
import { lockSeatsLua } from "../utils/seatLock.lua.js";
import { calcTotalFromLayout } from "../utils/calcTotal.js";

import { sendMail } from "../services/mail.service.js";
import { bookingConfirmTemplate } from "../templates/bookingConfirm.js";

import Stripe from "stripe";
import { generateBookingQRBuffer } from "../utils/generateQr.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const LOCK_TTL_SECONDS = 300; // 5 mins
const lockKey = (showId) => `lock:show:${showId}`;

// =====================================
// Cache Versioning (Bookings)
// =====================================
const BOOKINGS_CACHE_VERSION_KEY = "bookings:cache:version";

const getBookingsCacheVersion = async () => {
  const v = await redis.get(BOOKINGS_CACHE_VERSION_KEY);
  if (!v) {
    await redis.set(BOOKINGS_CACHE_VERSION_KEY, "1");
    return "1";
  }
  return v;
};

const bumpBookingsCacheVersion = async () => {
  await redis.incr(BOOKINGS_CACHE_VERSION_KEY);
};

// =====================================
// Cache Key Helpers
// =====================================
const myBookingsKey = (version, userId) => `bookings:v${version}:my:${userId}`;
const bookingDetailsKey = (version, bookingId) =>
  `bookings:v${version}:details:${bookingId}`;
const adminBookingsKey = (version, limit, cursor) =>
  `bookings:v${version}:admin:list:limit=${limit}:cursor=${cursor || "null"}`;

/**
 * POST /api/shows/:showId/lock
 * body: { seats: ["A1","A2"] }
 */


/**
 * POST /api/bookings/confirm
 * body: { bookingId, paymentIntentId, skipLock }
 */
export const confirmBooking = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { bookingId, paymentIntentId, skipLock } = req.body;

  const skipLockBool = skipLock === true || skipLock === "true";

  if (!bookingId) throw new AppError("bookingId is required", 400);
  if (!paymentIntentId) throw new AppError("paymentIntentId is required", 400);

  // 1) Find booking (light select)
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      userId: true,
      showId: true,
      bookedSeats: true,
      isPaid: true,

      user: { select: { email: true, name: true } },

      show: {
        select: {
          id: true,
          startTime: true,
          movie: true,
          screen: {
            select: {
              id: true,
              name: true,
              layout: true,
              theatre: true,
            },
          },
        },
      },
    },
  });

  if (!booking) throw new AppError("Booking not found", 404);
  if (booking.userId !== userId) throw new AppError("Not allowed", 403);

  if (booking.isPaid) {
    return res.json({
      success: true,
      message: "Booking already confirmed",
      booking,
    });
  }

  const showId = booking.showId;
  const seats = booking.bookedSeats;
  const show = booking.show;

  if (!show) throw new AppError("Show not found", 404);
  if (!seats || seats.length === 0) throw new AppError("No seats in booking", 400);

  // 2) Stripe verify
  const pi = await stripe.paymentIntents.retrieve(paymentIntentId);

  if (pi.status !== "succeeded") {
    throw new AppError("Payment not completed", 400);
  }

  // metadata checks
  if (pi.metadata?.userId !== userId) throw new AppError("Payment user mismatch", 403);
  if (pi.metadata?.showId !== showId) throw new AppError("Payment show mismatch", 403);
  if (pi.metadata?.bookingId !== bookingId)
    throw new AppError("Payment booking mismatch", 403);

  // 3) Check locked seats belong to this user (ONLY if skipLock is false)
  const key = lockKey(showId);

  if (!skipLockBool) {
    const pipeline = redis.pipeline();
    seats.forEach((seat) => pipeline.hget(key, seat));
    const results = await pipeline.exec();

    for (let i = 0; i < seats.length; i++) {
      const lockedBy = results[i]?.[1];
      if (lockedBy !== userId) {
        throw new AppError(`Seat ${seats[i]} is not locked by you`, 409);
      }
    }
  }

  // 4) DB booking conflict check (only CONFIRMED, ignore current booking)
  const bookingRows = await prisma.booking.findMany({
    where: {
      showId,
      status: "CONFIRMED",
      NOT: { id: bookingId },
    },
    select: { bookedSeats: true },
  });

  const alreadyBooked = new Set(bookingRows.flatMap((b) => b.bookedSeats));
  const conflict = seats.find((s) => alreadyBooked.has(s));

  if (conflict) throw new AppError(`Seat ${conflict} already booked`, 409);

  // 5) Layout pricing
  const totalAmount = calcTotalFromLayout(show.screen?.layout, seats);
  if (totalAmount <= 0) throw new AppError("Invalid seat pricing", 400);

  // Stripe amount check
  const stripeAmount = (pi.amount_received || pi.amount) / 100;
  if (Number(stripeAmount) !== Number(totalAmount)) {
    throw new AppError("Payment amount mismatch", 400);
  }

  // 6) Update booking (✅ MUST BE CONFIRMED)
  const updatedBooking = await prisma.booking.update({
    where: { id: bookingId },
    data: {
      totalAmount,
      isPaid: true,
      paymentIntentId,
      reminderSent: false,
      status: "CONFIRMED", // ✅ FIXED
    },
    include: {
      user: { select: { email: true, name: true } },
      show: {
        include: {
          movie: true,
          screen: { include: { theatre: true } },
        },
      },
    },
  });

  // 7) Generate QR buffer
  const qrBuffer = await generateBookingQRBuffer(updatedBooking.id);

  // 8) Send email
  await sendMail({
    to: updatedBooking.user.email,
    subject: "🎟 Booking Confirmed",
    html: bookingConfirmTemplate(updatedBooking),
    attachments: [
      {
        filename: `ticket-${updatedBooking.id}.png`,
        content: qrBuffer,
        cid: "booking_qr",
      },
    ],
  });

  // 9) Remove locks (ONLY if skipLock is false)
  if (!skipLockBool) {
    await redis.hdel(key, ...seats);
  }

  // invalidate booking caches
  await bumpBookingsCacheVersion();

  return res.status(200).json({
    success: true,
    message: "Booking confirmed",
    booking: updatedBooking,
  });
});

// =====================================
// ADMIN: all bookings (cached)
// GET /api/bookings/all?limit=20&cursor=xxx
// =====================================
export const getAllBookings = asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 50);
  const cursor = req.query.cursor || null;

  const version = await getBookingsCacheVersion();
  const cacheKey = adminBookingsKey(version, limit, cursor);

  const cached = await redis.get(cacheKey);
  if (cached) {
    return res.json({
      success: true,
      source: "cache",
      ...JSON.parse(cached),
    });
  }

  const bookings = await prisma.booking.findMany({
    take: limit + 1,
    ...(cursor && {
      skip: 1,
      cursor: { id: cursor },
    }),
    select: {
      id: true,
      bookedSeats: true,
      totalAmount: true,
      isPaid: true,
      status: true,
      createdAt: true,

      user: { select: { id: true, name: true, email: true } },
      show: {
        select: {
          id: true,
          startTime: true,
          movie: { select: { id: true, title: true, posterPath: true } },
          screen: {
            select: {
              id: true,
              name: true,
              theatre: { select: { id: true, name: true, city: true } },
            },
          },
        },
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });

  const hasNextPage = bookings.length > limit;
  const data = hasNextPage ? bookings.slice(0, limit) : bookings;

  const responseData = {
    bookings: data,
    nextCursor: hasNextPage ? data[data.length - 1].id : null,
    hasNextPage,
  };

  await redis.set(cacheKey, JSON.stringify(responseData), "EX", 20);

  res.json({
    success: true,
    source: "db",
    ...responseData,
  });
});

// =====================================
// GET booking by id (cached + secure)
// GET /api/bookings/:id
// =====================================
export const getBookingById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  if (!id) throw new AppError("Booking id is required", 400);

  const version = await getBookingsCacheVersion();
  const cacheKey = bookingDetailsKey(version, id);

  const cached = await redis.get(cacheKey);
  if (cached) {
    const booking = JSON.parse(cached);

    if (booking.userId !== userId) throw new AppError("Not allowed", 403);

    return res.json({
      success: true,
      source: "cache",
      booking,
    });
  }

  const booking = await prisma.booking.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      showId: true,
      bookedSeats: true,
      totalAmount: true,
      isPaid: true,
      status: true,
      createdAt: true,

      show: {
        select: {
          id: true,
          startTime: true,
          movie: { select: { id: true, title: true, posterPath: true } },
          screen: {
            select: {
              id: true,
              name: true,
              theatre: { select: { id: true, name: true, city: true } },
            },
          },
        },
      },
    },
  });

  if (!booking) throw new AppError("Booking not found", 404);
  if (booking.userId !== userId) throw new AppError("Not allowed", 403);

  await redis.set(cacheKey, JSON.stringify(booking), "EX", 60);

  res.json({
    success: true,
    source: "db",
    booking,
  });
});

// =====================================
// POST /api/bookings
// =====================================
export const createBooking = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { showId, seats } = req.body;

  if (!showId) throw new AppError("showId is required", 400);
  if (!seats || !Array.isArray(seats) || seats.length === 0) {
    throw new AppError("seats array is required", 400);
  }

  // optional: prevent duplicate pending booking for same show + same seats
  const existing = await prisma.booking.findFirst({
    where: {
      userId,
      showId,
      isPaid: false,
      bookedSeats: { equals: seats },
    },
  });

  if (existing) {
    return res.json({ success: true, booking: existing });
  }

  const booking = await prisma.booking.create({
    data: {
      userId,
      showId,
      bookedSeats: seats,
      totalAmount: 0,
      isPaid: false,
      reminderSent: false,
      status: "PENDING",
    },
  });

  await bumpBookingsCacheVersion();

  res.json({ success: true, booking });
});

// =====================================
// GET /api/bookings/my
// =====================================
export const getMyBookings = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const version = await getBookingsCacheVersion();
  const cacheKey = myBookingsKey(version, userId);

  const cached = await redis.get(cacheKey);
  if (cached) {
    return res.json({
      success: true,
      source: "cache",
      bookings: JSON.parse(cached),
    });
  }

  const bookings = await prisma.booking.findMany({
    where: { userId },
    select: {
      id: true,
      bookedSeats: true,
      totalAmount: true,
      isPaid: true,
      status: true,
      createdAt: true,
      show: {
        select: {
          id: true,
          startTime: true,
          movie: { select: { id: true, title: true, posterPath: true } },
          screen: {
            select: {
              id: true,
              name: true,
              theatre: { select: { id: true, name: true, city: true } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  await redis.set(cacheKey, JSON.stringify(bookings), "EX", 30);

  return res.json({ success: true, source: "db", bookings });
});