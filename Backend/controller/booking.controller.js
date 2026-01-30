import { prisma } from "../config/prisma.js";
import asyncHandler from "../middlewares/asyncHandler.js";
import AppError from "../utils/AppError.js";
import { expireOldBookings } from "../utils/expireOldBookings.js";
import redis from "../config/redis.js";

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
  const { bookingId } = req.params;
  const userId = req.user.id;

  if (!bookingId ) throw new AppError("Booking id is required", 400);

  const version = await getBookingsCacheVersion();
  const cacheKey = bookingDetailsKey(version, bookingId );

  const cached = await redis.get(cacheKey);
  if (cached) {
    const booking = JSON.parse(cached);

    if (booking.userId !== userId) {
      throw new AppError("Not allowed", 403);
    }

    return res.json({
      success: true,
      source: "cache",
      booking,
    });
  }

  const booking = await prisma.booking.findUnique({
    where: { id : bookingId },
    select: {
      id: true,
      userId: true,
      showId: true,
      bookedSeats: true,
      totalAmount: true,
      isPaid: true,
      status: true,
      createdAt: true,
      expiredAt: true, // 🔥 REQUIRED

      show: {
        select: {
          id: true,
          startTime: true,
          movie: {
            select: { id: true, title: true, posterPath: true },
          },
          screen: {
            select: {
              id: true,
              name: true,
              theatre: {
                select: { id: true, name: true, city: true },
              },
            },
          },
        },
      },
    },
  });

  if (!booking) throw new AppError("Booking not found", 404);
  if (booking.userId !== userId) throw new AppError("Not allowed", 403);

  if (booking.status === "EXPIRED") {
    throw new AppError("Booking expired", 410);
  }

  // ✅ Cache ONLY stable bookings
  if (booking.totalAmount > 0) {
    await redis.set(cacheKey, JSON.stringify(booking), "EX", 60);
  }
 const ttlSeconds = Math.floor(
  (booking.expiredAt.getTime() - Date.now()) / 1000
);

  res.json({
    success: true,
    source: "db",
    booking,
    ttlSeconds,
  });
});
// =====================================
// POST /api/bookings
// =====================================
export const createBooking = async (req, res, next) => {
  try {
    // 1️⃣ INPUT VALIDATION
    const { showId, seats } = req.body;
    const userId = req.user.id;

    if (!showId || !Array.isArray(seats) || seats.length === 0) {
      return res.status(400).json({ message: "Invalid input" });
    }

    // 2️⃣ LOCK TIME (8 minutes)
    const LOCK_TTL_SECONDS = 8 * 60;
    const expiresAt = new Date(Date.now() + LOCK_TTL_SECONDS * 1000);
      await expireOldBookings(tx);
    // 3️⃣ REDIS LOCK (FAST CHECK)
    for (const seatId of seats) {
      const key = `seat_lock:${showId}:${seatId}`;

      const locked = await redis.set(
        key,
        userId,
        "NX", // only set if not exists
        "EX", // auto expire
        LOCK_TTL_SECONDS
      );

      if (!locked) {
        // rollback redis locks
        for (const s of seats) {
          await redis.del(`seat_lock:${showId}:${s}`);
        }
        return res.status(409).json({
          message: `Seat ${seatId} is already locked`,
        });
      }
    }

    // 4️⃣ CREATE BOOKING (PENDING)
    const booking = await prisma.booking.create({
      data: {
        userId,
        showId,
        bookedSeats: seats,
        totalAmount: 0, // calculate later
        status: "PENDING",
        expiredAt: expiresAt,
      },
    });

    // 5️⃣ DB LOCK (FINAL AUTHORITY)
    try {
      await prisma.$transaction(
        seats.map((seatId) =>
          prisma.seatLock.create({
            data: {
              showId,
              seatId,
              userId,
              bookingId: booking.id,
              expiresAt,
            },
          })
        )
      );
    } catch (err) {
      // rollback redis if DB fails
      for (const seatId of seats) {
        await redis.del(`seat_lock:${showId}:${seatId}`);
      }

      // seat already locked in DB
    if (err?.code === "P2002") {
  return res.status(409).json({
    message: "Seat already locked by another user",
  });
}


      throw err;
    }

    // 6️⃣ SUCCESS
    return res.status(200).json({
      message: "Seats locked successfully",
      bookingId: booking.id,
      expiresAt,
    });
  } catch (error) {
    next(error);
  }
};


// =====================================
// GET /api/bookings/my
// =====================================
export const getMyBookings = asyncHandler(async (req, res) => {
  const userId = req.user.id;
 await expireOldBookings(prisma);
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