import { prisma } from "../config/prisma.js";
import asyncHandler from "../middlewares/asyncHandler.js";
import AppError from "../utils/AppError.js";

import redis from "../config/redis.js";

import { calcTotalFromLayout } from "../utils/calcTotal.js";



import Stripe from "stripe";


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





// ADMIN: all bookings (cached)
// GET /api/bookings/all?limit=20&cursor=xxx
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
    where: {
isPaid: true,
status: "CONFIRMED",
},
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
          screen: {
            select: {
              id: true,
              name: true,
              screenNo:true,
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

  // 1️⃣ Prevent duplicate pending booking
  const existing = await prisma.booking.findFirst({
    where: {
      userId,
      showId,
      isPaid: false,
    },
  });

  if (existing) {
    return res.json({ success: true, booking: existing });
  }

  // 2️⃣ Get show + screen layout
  const show = await prisma.show.findUnique({
    where: { id: showId },
    include: {
      screen: true,
    },
  });
 
  if (!show) throw new AppError("Show not found", 404);
  if (!show.screen?.layout) {
    throw new AppError("Screen layout not configured", 500);
  }
   if (new Date() >= show.startTime) {
  throw new AppError("Show already started", 400);
}
  // 3️⃣ Calculate total using layout
  const totalAmount = calcTotalFromLayout(show.screen.layout, seats,show.seatPrice);

  if (!totalAmount || totalAmount <= 0) {
    throw new AppError("Invalid seat pricing", 400);
  }
   const redisKey = lockKey(showId);

for (const seat of seats) {
  const lockedBy = await redis.hget(redisKey, seat);

  if (!lockedBy) {
    throw new AppError(
      "Seat lock expired. Please select seats again.",
      410
    );
  }

  if (String(lockedBy) !== String(userId)) {
    throw new AppError(
      "Seat is no longer available.",
      409
    );
  }
}
  // 4️⃣ Create booking with correct total
  const booking = await prisma.booking.create({
    data: {
      userId,
      showId,
      bookedSeats: seats,
      totalAmount, // ✅ FIXED
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

  const DAY = 24 * 60 * 60 * 1000;
  const cutoff = new Date(Date.now() - DAY);

  const bookings = await prisma.booking.findMany({
    where: {
      userId,
      OR: [
        { status: { not: "EXPIRED" } }, // CONFIRMED / PENDING / CANCELLED
        {
          status: "EXPIRED",
          expiredAt: { gte: cutoff },   // only recent expired
        },
      ],
    },
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
          movie: {
            select: {
              id: true,
              title: true,
              posterPath: true,
            },
          },
          screen: {
            select: {
              id: true,
              name: true,
              theatre: {
                select: {
                  id: true,
                  name: true,
                  city: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  await redis.set(cacheKey, JSON.stringify(bookings), "EX", 30);

  return res.json({
    success: true,
    source: "db",
    bookings,
  });
});