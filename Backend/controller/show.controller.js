import pkg from "@prisma/client";
const { PrismaClient } = pkg;

import asyncHandler from "../middlewares/asyncHandler.js";
import AppError from "../utils/AppError.js";
import redis from "../config/redis.js";
const prisma = new PrismaClient();
import { lockSeatsLua } from "../utils/seatLock.lua.js";

const LOCK_TTL_SECONDS = 300; // 5 mins
const lockKey = (showId) => `lock:show:${showId}`;

// GET /api/shows?movieId=xxx&date=2026-01-19

export const getShowsByMovieAndDate = asyncHandler(async (req, res) => {
  const { movieId, date } = req.query;

  if (!movieId || !date) {
    throw new AppError("movieId and date are required", 400);
  }

  // Date range for selected day
  const start = new Date(`${date}T00:00:00`);
  const end = new Date(`${date}T23:59:59.999`);

  // Validate date
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new AppError("Invalid date format. Use YYYY-MM-DD", 400);
  }

  // Check if selected date is today (safe compare)
  const todayStr = new Date().toISOString().slice(0, 10);
  const isToday = date === todayStr;

  // BookMyShow-like buffer (optional)
  const bufferMinutes = 10;
  const nowPlusBuffer = new Date(Date.now() + bufferMinutes * 60 * 1000);

  const shows = await prisma.show.findMany({
    where: {
      movieId,
      startTime: {
        gte: isToday ? nowPlusBuffer : start, // ✅ hide past + near-start shows
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

  res.json({
    success: true,
    shows,
  });
});

  
// GET /api/shows/:showId (SeatLayout page)
export const getShowById = asyncHandler(async (req, res) => {
  const { showId } = req.params;

  const show = await prisma.show.findUnique({
    where: { id: showId },
    include: {
      movie: true,
      screen: {
        include: {
          theatre: true, // ✅ theatre comes via screen
        },
      },
      bookings: true,
    },
  });

  if (!show) throw new AppError("Show not found", 404);

  // ✅ booked seats from DB
  const bookedSeats = show.bookings.flatMap((b) => b.bookedSeats);

  // ✅ locked seats from Redis
  const lockedMap = await redis.hgetall(`lock:show:${showId}`);
  const lockedSeats = Object.keys(lockedMap || {});

  res.json({
    success: true,
    show: {
      id: show.id,
      startTime: show.startTime,
      seatPrice: show.seatPrice,
      movie: show.movie,
      theatre: show.screen.theatre, // ✅ theatre from screen
      screen: show.screen, // ✅ screen.layout here
      bookedSeats,
      lockedSeats, // ✅ ADDED
    },
  });
});

// ADMIN: create show
export const createShow = asyncHandler(async (req, res) => {
  const { movieId, screenId, startTime, seatPrice, seatPrices } = req.body;

  if (!movieId || !screenId || !startTime || !seatPrice) {
    throw new AppError(
      "movieId, screenId, startTime, seatPrice are required",
      400
    );
  }

  // optional: check screen exists
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
      seatPrices, // optional JSON
    },
  });

  res.status(201).json({ success: true, show });
});

export const getShowsByMovie = asyncHandler(async (req, res) => {
  const { movieId } = req.params;

  if (!movieId) throw new AppError("movieId is required", 400);

  const shows = await prisma.show.findMany({
    where: { movieId,
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

  res.json({ success: true, shows });
});
// GET /api/shows/theatre/:theatreId
export const getShowsByTheatre = asyncHandler(async (req, res) => {
  const { theatreId } = req.params;
  if (!theatreId) throw new AppError("theatreId is required", 400);

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

  res.json({ success: true, shows });
});


// GET /api/shows/all  (ADMIN)
export const getAllShowsAdmin = asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 50);
  const cursor = req.query.cursor || null;

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
    // stable order (better than only startTime)
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

  res.json({
    success: true,
    shows: formatted,
    nextCursor: hasNextPage ? data[data.length - 1].id : null,
    hasNextPage,
  });
});

// POST /api/shows/:showId/lock
export const lockSeats = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { showId } = req.params;
  const { seats } = req.body;

  if (!showId) throw new AppError("showId is required", 400);
  if (!seats || !Array.isArray(seats) || seats.length === 0) {
    throw new AppError("seats array is required", 400);
  }

  // check show exists + booked seats
  const show = await prisma.show.findUnique({
    where: { id: showId },
    select: {
      id: true,
      bookings: { select: { bookedSeats: true } },
    },
  });

  if (!show) throw new AppError("Show not found", 404);

  // already booked check
  const alreadyBooked = new Set(show.bookings.flatMap((b) => b.bookedSeats));
  const conflictBooked = seats.find((s) => alreadyBooked.has(s));
  if (conflictBooked) {
    throw new AppError(`Seat ${conflictBooked} already booked`, 409);
  }

  // atomic lock in redis
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

// POST /api/shows/:showId/unlock
export const unlockSeats = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { showId } = req.params;
  const { seats } = req.body;

  if (!showId) throw new AppError("showId is required", 400);
  if (!seats || !Array.isArray(seats) || seats.length === 0) {
    throw new AppError("seats array is required", 400);
  }

  const key = lockKey(showId);

  // pipeline all hget
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
