import { prisma } from "../config/prisma.js";
import asyncHandler from "../middlewares/asyncHandler.js";
import AppError from "../utils/AppError.js";
import { expireOldBookings } from "../utils/expireOldBookings.js";

// =====================================
// GET /api/shows?movieId=xxx&date=YYYY-MM-DD
// =====================================

// =====================================
// GET SHOWS BY MOVIE + DATE (NO CACHE)
// =====================================
export const getShowsByMovieAndDate = asyncHandler(async (req, res) => {
  const { movieId, date } = req.query;

  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  const end = new Date(date);
  end.setHours(23, 59, 59, 999);

  const now = new Date();
  const GRACE_MINUTES = 15;

  const shows = await prisma.show.findMany({
    where: {
      movieId,
      startTime: { gte: start, lte: end },
    },
    select: {
      id: true,
      startTime: true,
      screen: {
        select: {
          id: true,
          name: true,
          theatre: true,
        },
      },
    },
    orderBy: { startTime: "asc" },
  });

  const showsWithStatus = shows.map((s) => {
    const diff = s.startTime.getTime() - now.getTime();

    const isStarted = now >= s.startTime;
    const isBookable = diff > -GRACE_MINUTES * 60000;
    const isEnded = diff <= -GRACE_MINUTES * 60000;

    return {
      ...s,
      isStarted,   // running started
      isBookable,  // booking allowed
      isEnded,     // fully closed
    };
  });

  res.json({ success: true, shows: showsWithStatus });
});

// =====================================
// GET /api/shows/:showId
// =====================================
export const getShowById = asyncHandler(async (req, res) => {
 

  const { showId } = req.params;
     await expireOldBookings(prisma);
  const show = await prisma.show.findUnique({
    where: { id: showId },
    select: {
      id: true,
      startTime: true,
      seatPrice: true,
      movie: {
        select: { id: true, title: true },
      },
      screen: {
        select: {
          id: true,
          name: true,
          layout: true,
          theatre: {
            select: {
              id: true,
              name: true,
              city: true,
              address: true,
            },
          },
        },
      },
    },
  });

  if (!show) throw new AppError("Show not found", 404);

  const bookingRows = await prisma.booking.findMany({
    where: {
      showId,
      status: "CONFIRMED",
    },
    select: { bookedSeats: true },
  });

  const bookedSeats = bookingRows.flatMap((b) => b.bookedSeats);

  res.json({
    success: true,
    show: {
      ...show,
      bookedSeats,
    },
  });
});

// =====================================
// ADMIN: CREATE SHOW
// POST /api/shows
// =====================================
export const createShow = asyncHandler(async (req, res) => {
  const { movieId, screenId, startTime, seatPrice } = req.body;

  if (!movieId || !screenId || !startTime || seatPrice === undefined) {
    throw new AppError("movieId, screenId, startTime, seatPrice are required", 400);
  }

  const screen = await prisma.screen.findUnique({
    where: { id: screenId },
    select: { theatreId: true },
  });

  if (!screen) throw new AppError("Screen not found", 404);

  const movie = await prisma.movie.findUnique({
    where: { id: movieId },
    select: { runtime: true },
  });

  const start = new Date(startTime); // already UTC ISO from frontend

  if (isNaN(start)) throw new AppError("Invalid startTime", 400);

  const endTime = new Date(start.getTime() + movie.runtime * 60000);

  const show = await prisma.show.create({
    data: {
      movieId,
      screenId,
      startTime: start,
      endTime,
      seatPrice,
    },
  });

  res.status(201).json({ success: true, show });
});



// =====================================
// GET /api/shows/movie/:movieId
// =====================================
export const getShowsByMovie = asyncHandler(async (req, res) => {
  const { movieId } = req.params;
  if (!movieId) throw new AppError("movieId is required", 400);

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const shows = await prisma.show.findMany({
    where: {
      movieId,
      startTime: { gte: startOfToday },
    },
    select: {
      id: true,
      startTime: true,
      seatPrice: true,
      screen: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { startTime: "asc" },
  });

  res.json({ success: true, source: "db", shows });
});

// =====================================


// =====================================
// GET SHOWS BY THEATRE 
// =====================================
export const getShowsByTheatre = asyncHandler(async (req, res) => {
  const { theatreId } = req.params;

  const now = new Date();

  // ✅ today only filter
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const GRACE_MINUTES = 15;

  const shows = await prisma.show.findMany({
    where: {
      screen: { theatreId },
      startTime: {
        gte: start,
        lte: end,
      },
    },
    select: {
      id: true,
      startTime: true,
      movie: {
        select: {
          id: true,
          title: true,
          posterPath: true,
          runtime: true,
          voteAverage: true,
          releaseDate: true,
          genres: {
            select: { id: true, name: true },
          },
        },
      },
      screen: {
        select: { id: true, name: true },
      },
    },
    orderBy: { startTime: "asc" },
  });

  const showsWithStatus = shows.map((show) => {
    const diff = show.startTime.getTime() - now.getTime();

    const isStarted = now >= show.startTime;

    const isBookable = diff > -GRACE_MINUTES * 60000;

    const isEnded = diff <= -GRACE_MINUTES * 60000;

    return {
      ...show,
      isStarted,
      isBookable,
      isEnded,
    };
  });

  res.json({ success: true, shows: showsWithStatus });
});



// =====================================
// ADMIN: GET ALL SHOWS
// =====================================
// =====================================
// SHOW STATUS HELPER
// =====================================
const getShowStatus = (now, startTime, endTime) => {
  if (now < startTime) return "UPCOMING";
  if (now >= startTime && now <= endTime) return "RUNNING";
  return "ENDED";
};

// =====================================
// ADMIN: GET ALL SHOWS (SAFE VERSION)
// =====================================
export const getAllShowsAdmin = asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 50);
  const cursor = req.query.cursor || null;

  const now = new Date();

  // -----------------------------
  // Fetch shows (NO layout logic)
  // -----------------------------
  const shows = await prisma.show.findMany({
    take: limit + 1,
    ...(cursor && {
      skip: 1,
      cursor: { id: cursor },
    }),
    select: {
      id: true,
      startTime: true,
      seatPrice: true,
      movie: {
        select: {
          id: true,
          title: true,
          runtime: true,
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
              area: true,
            },
          },
        },
      },
    },
    orderBy: [{ startTime: "desc" }, { id: "desc" }],
  });

  const hasNextPage = shows.length > limit;
  const data = hasNextPage ? shows.slice(0, limit) : shows;

  const showIds = data.map((s) => s.id);

  // -----------------------------
  // Earnings + tickets sold
  // -----------------------------
  const earningsAgg = await prisma.booking.groupBy({
    by: ["showId"],
    where: {
      showId: { in: showIds },
      status: "CONFIRMED",
    },
    _sum: {
      totalAmount: true,
    },
    _count: {
      id: true, // booking count
    },
  });

  const earningsMap = new Map(
    earningsAgg.map((x) => [
      x.showId,
      {
        earnings: x._sum.totalAmount || 0,
        ticketsSold: x._count.id,
      },
    ])
  );

  // -----------------------------
  // Format response
  // -----------------------------
  const formatted = data.map((s) => {
    const runtime = s.movie?.runtime || 0;

    const endTime = new Date(
      s.startTime.getTime() + runtime * 60 * 1000
    );

    const sold = earningsMap.get(s.id)?.ticketsSold || 0;

    return {
      id: s.id,
      startTime: s.startTime,
      endTime,
      status: getShowStatus(now, s.startTime, endTime),
      seatPrice: s.seatPrice,
      movie: s.movie,
      theatre: s.screen?.theatre,
      screen: {
        id: s.screen.id,
        name: s.screen.name,
      },
      stats: {
        ticketsSold: sold,
      },
      earnings: {
        amount: earningsMap.get(s.id)?.earnings || 0,
        currency: "INR",
      },
      canEdit: now < s.startTime,
    };
  });

  // -----------------------------
  // Response
  // -----------------------------
  res.json({
    success: true,
    source: "db",
    shows: formatted,
    nextCursor: hasNextPage ? data[data.length - 1].id : null,
    hasNextPage,
  });
});
