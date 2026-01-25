import pkg from "@prisma/client";
const { PrismaClient } = pkg;

import asyncHandler from "../middlewares/asyncHandler.js";
import AppError from "../utils/AppError.js";

import redis from "../config/redis.js";
import { lockSeatsLua } from "../utils/seatLock.lua.js";

const prisma = new PrismaClient();

const LOCK_TTL_SECONDS = 300; // 5 mins
const lockKey = (showId) => `lock:show:${showId}`;

// =====================================
// ✅ Resume-ready Cache Versioning (Shows)
// =====================================
const SHOWS_CACHE_VERSION_KEY = "shows:cache:version";

const getShowsCacheVersion = async () => {
  const v = await redis.get(SHOWS_CACHE_VERSION_KEY);
  if (!v) {
    await redis.set(SHOWS_CACHE_VERSION_KEY, "1");
    return "1";
  }
  return v;
};

const bumpShowsCacheVersion = async () => {
  await redis.incr(SHOWS_CACHE_VERSION_KEY);
};

// =====================================
// Cache Key Helpers
// =====================================
const showsByMovieAndDateKey = (version, movieId, date) =>
  `shows:v${version}:movie=${movieId}:date=${date}`;

const showBaseKey = (version, showId) => `shows:v${version}:base:${showId}`;

const showsByMovieKey = (version, movieId) => `shows:v${version}:movie=${movieId}`;

const showsByTheatreKey = (version, theatreId, date) =>
  `shows:v${version}:theatre=${theatreId}:date=${date}`;

const adminShowsKey = (version, limit, cursor) =>
  `shows:v${version}:admin:list:limit=${limit}:cursor=${cursor || "null"}`;

// =====================================
// GET /api/shows?movieId=xxx&date=YYYY-MM-DD
// =====================================
export const getShowsByMovieAndDate = asyncHandler(async (req, res) => {
  const { movieId, date } = req.query;

  if (!movieId || !date) {
    throw new AppError("movieId and date are required", 400);
  }

  // Date range for selected day
  const start = new Date(`${date}T00:00:00`);
  const end = new Date(`${date}T23:59:59.999`);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new AppError("Invalid date format. Use YYYY-MM-DD", 400);
  }

  const version = await getShowsCacheVersion();
  const cacheKey = showsByMovieAndDateKey(version, movieId, date);

  // ✅ Cache check (20 sec)
  const cached = await redis.get(cacheKey);
  if (cached) {
    return res.json({
      success: true,
      source: "cache",
      shows: JSON.parse(cached),
    });
  }

  // Check if selected date is today (safe compare)
  const todayStr = new Date().toISOString().slice(0, 10);
  const isToday = date === todayStr;

  // BookMyShow-like buffer
  const bufferMinutes = 10;
  const nowPlusBuffer = new Date(Date.now() + bufferMinutes * 60 * 1000);

  const shows = await prisma.show.findMany({
    where: {
      movieId,
      startTime: {
        gte: isToday ? nowPlusBuffer : start,
        lte: end,
      },
    },
    include: {
      screen: {
        include: {
          theatre: true,
        },
      },
    },
    orderBy: { startTime: "asc" },
  });

  await redis.set(cacheKey, JSON.stringify(shows), "EX", 20);

  res.json({
    success: true,
    source: "db",
    shows,
  });
});

// =====================================
// GET /api/shows/:showId  (SeatLayout page)
// =====================================
export const getShowById = asyncHandler(async (req, res) => {
  const { showId } = req.params;

  const version = await getShowsCacheVersion();
  const cacheKey = showBaseKey(version, showId);

  // ✅ Cache base show info (movie + screen + theatre)
  const cached = await redis.get(cacheKey);

  let baseShow;

  if (cached) {
    baseShow = JSON.parse(cached);
  } else {
    const show = await prisma.show.findUnique({
      where: { id: showId },
      include: {
        movie: true,
        screen: {
          include: {
            theatre: true,
          },
        },
        bookings: true,
      },
    });

    if (!show) throw new AppError("Show not found", 404);

    // store base data (without bookings)
    baseShow = {
      id: show.id,
      startTime: show.startTime,
      seatPrice: show.seatPrice,
      movie: show.movie,
      theatre: show.screen.theatre,
      screen: show.screen,
    };

    await redis.set(cacheKey, JSON.stringify(baseShow), "EX", 30);
  }

  // ✅ booked seats ALWAYS fresh from DB
  const bookingRows = await prisma.booking.findMany({
    where: { showId },
    select: { bookedSeats: true },
  });
  const bookedSeats = bookingRows.flatMap((b) => b.bookedSeats);

  // ✅ locked seats ALWAYS fresh from Redis
  const lockedMap = await redis.hgetall(lockKey(showId));
  const lockedSeats = Object.keys(lockedMap || {});

  res.json({
    success: true,
    source: cached ? "cache+freshSeats" : "db+freshSeats",
    show: {
      ...baseShow,
      bookedSeats,
      lockedSeats,
    },
  });
});

// =====================================
// ADMIN: CREATE SHOW
// POST /api/shows
// =====================================
export const createShow = asyncHandler(async (req, res) => {
  const { movieId, screenId, startTime, seatPrice, seatPrices } = req.body;

  if (!movieId || !screenId || !startTime || !seatPrice) {
    throw new AppError(
      "movieId, screenId, startTime, seatPrice are required",
      400
    );
  }

  const screen = await prisma.screen.findUnique({
    where: { id: screenId },
  });

  if (!screen) throw new AppError("Screen not found", 404);

  const show = await prisma.show.create({
    data: {
      movieId,
      screenId,
      startTime: new Date(startTime),
      seatPrice,
      seatPrices,
    },
  });

  // ✅ invalidate shows cache
  await bumpShowsCacheVersion();

  res.status(201).json({ success: true, show });
});

// =====================================
// GET /api/shows/movie/:movieId
// =====================================
export const getShowsByMovie = asyncHandler(async (req, res) => {
  const { movieId } = req.params;

  if (!movieId) throw new AppError("movieId is required", 400);

  const version = await getShowsCacheVersion();
  const cacheKey = showsByMovieKey(version, movieId);

  const cached = await redis.get(cacheKey);
  if (cached) {
    return res.json({ success: true, source: "cache", shows: JSON.parse(cached) });
  }

  const shows = await prisma.show.findMany({
    where: {
      movieId,
      startTime: { gte: new Date() },
    },
    include: {
      screen: {
        include: {
          theatre: true,
        },
      },
    },
    orderBy: { startTime: "asc" },
  });

  await redis.set(cacheKey, JSON.stringify(shows), "EX", 20);

  res.json({ success: true, source: "db", shows });
});

// =====================================
// GET /api/shows/theatre/:theatreId
// =====================================
export const getShowsByTheatre = asyncHandler(async (req, res) => {
  const { theatreId } = req.params;
  if (!theatreId) throw new AppError("theatreId is required", 400);

  const todayStr = new Date().toISOString().slice(0, 10);

  const version = await getShowsCacheVersion();
  const cacheKey = showsByTheatreKey(version, theatreId, todayStr);

  const cached = await redis.get(cacheKey);
  if (cached) {
    return res.json({ success: true, source: "cache", shows: JSON.parse(cached) });
  }

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const shows = await prisma.show.findMany({
    where: {
      screen: {
        is: { theatreId },
      },
      startTime: { gte: startOfDay, lte: endOfDay },
    },
    include: {
      movie: {
        include: { genres: true },
      },
      screen: true,
    },
    orderBy: { startTime: "asc" },
  });

  await redis.set(cacheKey, JSON.stringify(shows), "EX", 20);

  res.json({ success: true, source: "db", shows });
});

// =====================================
// GET /api/shows/all  (ADMIN)
// =====================================
export const getAllShowsAdmin = asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 50);
  const cursor = req.query.cursor || null;

  const version = await getShowsCacheVersion();
  const cacheKey = adminShowsKey(version, limit, cursor);

  const cached = await redis.get(cacheKey);
  if (cached) {
    return res.json({
      success: true,
      source: "cache",
      ...JSON.parse(cached),
    });
  }

  const shows = await prisma.show.findMany({
    take: limit + 1,
    ...(cursor && {
      skip: 1,
      cursor: { id: cursor },
    }),
    include: {
      movie: true,
      bookings: true,
      screen: {
        include: {
          theatre: true,
        },
      },
    },
    orderBy: [{ startTime: "desc" }, { id: "desc" }],
  });

  const hasNextPage = shows.length > limit;
  const data = hasNextPage ? shows.slice(0, limit) : shows;

  const formatted = data.map((s) => ({
    id: s.id,
    startTime: s.startTime,
    seatPrice: s.seatPrice,
    movie: s.movie,
    screen: s.screen,
    theatre: s.screen?.theatre,
    totalBookings: s.bookings?.length || 0,
    earnings: (s.bookings || []).reduce(
      (sum, b) => sum + (b.totalAmount || 0),
      0
    ),
  }));

  const responseData = {
    shows: formatted,
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
// POST /api/shows/:showId/lock
// =====================================
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

// =====================================
// POST /api/shows/:showId/unlock
// =====================================
export const unlockSeats = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { showId } = req.params;
  const { seats } = req.body;

  if (!showId) throw new AppError("showId is required", 400);
  if (!seats || !Array.isArray(seats) || seats.length === 0) {
    throw new AppError("seats array is required", 400);
  }

  const key = lockKey(showId);

  const pipeline = redis.pipeline();
  seats.forEach((seat) => pipeline.hget(key, seat));
  const results = await pipeline.exec();

  const toDelete = [];
  results.forEach((r, i) => {
    const lockedBy = r?.[1];
    if (lockedBy === userId) toDelete.push(seats[i]);
  });

  if (toDelete.length > 0) {
    await redis.hdel(key, ...toDelete);
  }

  return res.json({
    success: true,
    message: "Seats unlocked",
    seats,
  });
});