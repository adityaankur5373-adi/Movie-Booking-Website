import pkg from "@prisma/client";
const { PrismaClient } = pkg;

import asyncHandler from "../middlewares/asyncHandler.js";
import AppError from "../utils/AppError.js";

import redis from "../config/redis.js";
import { lockSeatsLua } from "../utils/seatLock.lua.js";
import { calcTotalFromLayout } from "../utils/calcTotal.js";

import { emailQueue } from "../queues/email.queue.js";
import { bookingConfirmTemplate } from "../templates/bookingConfirm.js";
import { showReminderTemplate } from "../templates/showReminder.js";

import Stripe from "stripe";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const prisma = new PrismaClient();

const LOCK_TTL_SECONDS = 300; // 5 mins
const lockKey = (showId) => `lock:show:${showId}`;

// =====================================
// ✅ Resume-ready Cache Versioning (Bookings)
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
 **/
export const lockSeats = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { showId } = req.params;
  const { seats } = req.body;

  if (!showId) throw new AppError("showId is required", 400);
  if (!seats || !Array.isArray(seats) || seats.length === 0) {
    throw new AppError("seats array is required", 400);
  }

  const show = await prisma.show.findUnique({
    where: { id: showId },
    select: {
      id: true,
      bookings: { select: { bookedSeats: true } },
    },
  });

  if (!show) throw new AppError("Show not found", 404);

  const alreadyBooked = new Set(show.bookings.flatMap((b) => b.bookedSeats));
  const conflictBooked = seats.find((s) => alreadyBooked.has(s));
  if (conflictBooked) {
    throw new AppError(`Seat ${conflictBooked} already booked`, 409);
  }

  const result = await redis.eval(
    lockSeatsLua,
    1,
    lockKey(showId),
    LOCK_TTL_SECONDS,
    userId,
    ...seats
  );

  if (Array.isArray(result) && result[0] === 0) {
    throw new AppError(`Seat ${result[1]} is already locked`, 409);
  }

  const ttlRemaining = await redis.ttl(lockKey(showId));

  return res.json({
    success: true,
    message: "Seats locked successfully",
    seats,
    ttlSeconds: LOCK_TTL_SECONDS,
    ttlRemaining,
  });
});

/**
 * POST /api/bookings/confirm
 * body: { showId, seats, paymentIntentId }
 */
export const confirmBooking = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { showId, seats, paymentIntentId } = req.body;

  if (!showId) throw new AppError("showId is required", 400);
  if (!seats || !Array.isArray(seats) || seats.length === 0) {
    throw new AppError("seats array is required", 400);
  }

  if (!paymentIntentId) {
    throw new AppError("paymentIntentId is required", 400);
  }

  // ✅ Stripe verify
  const pi = await stripe.paymentIntents.retrieve(paymentIntentId);

  if (pi.status !== "succeeded") {
    throw new AppError("Payment not completed", 400);
  }

  if (pi.metadata?.userId !== userId) {
    throw new AppError("Payment user mismatch", 403);
  }
  if (pi.metadata?.showId !== showId) {
    throw new AppError("Payment show mismatch", 403);
  }

  // show + screen layout for pricing
  const show = await prisma.show.findUnique({
    where: { id: showId },
    select: {
      id: true,
      startTime: true,
      bookings: { select: { bookedSeats: true } },
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
  });

  if (!show) throw new AppError("Show not found", 404);

  // 1) Check locked seats belong to this user
  const key = lockKey(showId);

  const pipeline = redis.pipeline();
  seats.forEach((seat) => pipeline.hget(key, seat));
  const results = await pipeline.exec();

  for (let i = 0; i < seats.length; i++) {
    const lockedBy = results[i]?.[1];
    if (lockedBy !== userId) {
      throw new AppError(`Seat ${seats[i]} is not locked by you`, 409);
    }
  }

  // 2) DB booking conflict again
  const alreadyBooked = new Set(show.bookings.flatMap((b) => b.bookedSeats));
  const conflict = seats.find((s) => alreadyBooked.has(s));
  if (conflict) throw new AppError(`Seat ${conflict} already booked`, 409);

  // 3) Layout pricing
  const totalAmount = calcTotalFromLayout(show.screen?.layout, seats);
  if (totalAmount <= 0) throw new AppError("Invalid seat pricing", 400);

  // Stripe amount check
  const stripeAmount = (pi.amount_received || pi.amount) / 100;
  if (Number(stripeAmount) !== Number(totalAmount)) {
    throw new AppError("Payment amount mismatch", 400);
  }

  // 4) Create booking
  const booking = await prisma.booking.create({
    data: {
      userId,
      showId,
      bookedSeats: seats,
      totalAmount,
      isPaid: true,
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

  // 5) Queue emails
  await emailQueue.add(
    "booking-confirmation",
    {
      type: "BOOKING_CONFIRMATION",
      bookingId: booking.id,
      to: booking.user.email,
      subject: "🎟 Booking Confirmed",
      html: bookingConfirmTemplate(booking),
    },
    { attempts: 3, backoff: { type: "exponential", delay: 2000 } }
  );

  const showTime = new Date(booking.show.startTime).getTime();
  const now = Date.now();

  const reminderTime = showTime - 2 * 60 * 60 * 1000; // 2 hours before
  const delay = reminderTime - now;

  if (delay > 0) {
    await emailQueue.add(
      "show-reminder",
      {
        type: "SHOW_REMINDER",
        to: booking.user.email,
        subject: "⏰ Your show starts in 2 hours!",
        html: showReminderTemplate(booking),
      },
      {
        delay,
        jobId: `reminder-${booking.id}`,
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
      }
    );
  }

  // 6) Remove locks
  await redis.hdel(key, ...seats);

  // ✅ invalidate booking caches
  await bumpBookingsCacheVersion();

  res.status(201).json({
    success: true,
    message: "Booking confirmed",
    booking,
  });
});

// =====================================
// USER: my bookings (cached)
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
    include: {
      show: {
        include: {
          movie: true,
          screen: { include: { theatre: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  await redis.set(cacheKey, JSON.stringify(bookings), "EX", 30);

  res.json({ success: true, source: "db", bookings });
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
    include: {
      user: { select: { id: true, name: true, email: true } },
      show: {
        include: {
          movie: true,
          screen: { include: { theatre: true } },
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

  await redis.set(cacheKey, JSON.stringify(responseData), "EX", 15);

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

    // ✅ security check even on cache
    if (booking.userId !== userId) throw new AppError("Not allowed", 403);

    return res.json({
      success: true,
      source: "cache",
      booking,
    });
  }

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      show: {
        include: {
          movie: true,
          screen: {
            include: {
              theatre: true,
            },
          },
        },
      },
    },
  });

  if (!booking) throw new AppError("Booking not found", 404);

  if (booking.userId !== userId) {
    throw new AppError("Not allowed", 403);
  }

  await redis.set(cacheKey, JSON.stringify(booking), "EX", 60);

  res.json({
    success: true,
    source: "db",
    booking,
  });
});