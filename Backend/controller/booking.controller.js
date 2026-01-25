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

  // ✅ Lightweight query: only get bookedSeats
  const show = await prisma.show.findUnique({
    where: { id: showId },
    select: {
      id: true,
      bookings: { select: { bookedSeats: true } },
    },
  });

  if (!show) throw new AppError("Show not found", 404);

  // check already booked in DB
  const alreadyBooked = new Set(show.bookings.flatMap((b) => b.bookedSeats));
  const conflictBooked = seats.find((s) => alreadyBooked.has(s));
  if (conflictBooked) {
    throw new AppError(`Seat ${conflictBooked} already booked`, 409);
  }

  // atomic lock in redis (Lua)
  const result = await redis.eval(
    lockSeatsLua,
    1,
    lockKey(showId),
    LOCK_TTL_SECONDS,
    userId,
    ...seats
  );

  // result format: {0, seat} or {1}
  if (Array.isArray(result) && result[0] === 0) {
    throw new AppError(`Seat ${result[1]} is already locked`, 409);
  }

  // ✅ get real remaining TTL from Redis
  const ttlRemaining = await redis.ttl(lockKey(showId)); // seconds

  return res.json({
    success: true,
    message: "Seats locked successfully",
    seats,
    ttlSeconds: LOCK_TTL_SECONDS,
    ttlRemaining, // ✅ ADDED
  });
});


/**
 * POST /api/shows/:showId/unlock
 * body: { seats: ["A1","A2"] }
 */
export const confirmBooking = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { showId, seats, paymentIntentId } = req.body;

  if (!showId) throw new AppError("showId is required", 400);
  if (!seats || !Array.isArray(seats) || seats.length === 0) {
    throw new AppError("seats array is required", 400);
  }

  // ✅ Stripe verify
  if (!paymentIntentId) {
    throw new AppError("paymentIntentId is required", 400);
  }

  const pi = await stripe.paymentIntents.retrieve(paymentIntentId);

  if (pi.status !== "succeeded") {
    throw new AppError("Payment not completed", 400);
  }

  // extra check: payment belongs to this user/show
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

  // 1) Check locked seats belong to this user (pipeline)
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

  // 2) Check DB booking conflict again
  const alreadyBooked = new Set(show.bookings.flatMap((b) => b.bookedSeats));
  const conflict = seats.find((s) => alreadyBooked.has(s));
  if (conflict) throw new AppError(`Seat ${conflict} already booked`, 409);

  // 3) Layout wise pricing
  const totalAmount = calcTotalFromLayout(show.screen?.layout, seats);

  if (totalAmount <= 0) throw new AppError("Invalid seat pricing", 400);

  // ✅ Check Stripe amount matches backend amount
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
    user: { select: { email: true, name: true } }, // ✅ added
    show: {
      include: {
        movie: true,
        screen: { include: { theatre: true } },
      },
    },
  },
});
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
      jobId: `reminder-${booking.id}`, // ✅ prevents duplicate reminder
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
    }
  );
}
  // 5) Remove locks
  await redis.hdel(key, ...seats);

  res.status(201).json({
    success: true,
    message: "Booking confirmed",
    booking,
  });
});

// USER: my bookings
export const getMyBookings = asyncHandler(async (req, res) => {
  const bookings = await prisma.booking.findMany({
    where: { userId: req.user.id },
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

  res.json({ success: true, bookings });
});

// ADMIN: all bookings (with cursor pagination)
export const getAllBookings = asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 50);
  const cursor = req.query.cursor || null;

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
  orderBy: [{ createdAt: "desc" }, { id: "desc" }]
  });

  const hasNextPage = bookings.length > limit;
  const data = hasNextPage ? bookings.slice(0, limit) : bookings;

  res.json({
    success: true,
    bookings: data,
    nextCursor: hasNextPage ? data[data.length - 1].id : null,
    hasNextPage,
  });
});
 
 export const getBookingById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id; // user must be logged in

  if (!id) {
    throw new AppError("Booking id is required", 400);
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

  if (!booking) {
    throw new AppError("Booking not found", 404);
  }

  // ✅ Security: only owner can view
  if (booking.userId !== userId) {
    throw new AppError("Not allowed", 403);
  }

  res.json({
    success: true,
    booking,
  });
});