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

  if (!movieId || !date) {
    throw new AppError("movieId and date are required", 400);
  }

  // -----------------------------------
  // Parse day boundaries
  // -----------------------------------
  const start = new Date(`${date}T00:00:00`);
  const end = new Date(`${date}T23:59:59.999`);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new AppError("Invalid date format. Use YYYY-MM-DD", 400);
  }

  const now = new Date();
  const GRACE_MINUTES = 15;

  // -----------------------------------
  // Fetch all shows of the day
  // -----------------------------------
  const shows = await prisma.show.findMany({
    where: {
      movieId,
      startTime: {
        gte: start, // ✅ full day
        lte: end,
      },
    },
    select: {
      id: true,
      startTime: true,

      screen: {
        select: {
          id: true,
          name: true,
          theatre: {
            select: {
              id: true,
              name: true,
              area: true,
              city: true,
              address: true,
            },
          },
        },
      },
    },
    orderBy: { startTime: "asc" },
  });

  // -----------------------------------
  // Group screens under theatre
  // -----------------------------------
  const theatreMap = {};

  for (const show of shows) {
    const theatre = show.screen?.theatre;
    if (!theatre) continue;

    if (!theatreMap[theatre.id]) {
      theatreMap[theatre.id] = {
        ...theatre,
        screenList: [],
      };
    }

    if (
      !theatreMap[theatre.id].screenList.some(
        (s) => s.id === show.screen.id
      )
    ) {
      theatreMap[theatre.id].screenList.push({
        id: show.screen.id,
        name: show.screen.name,
      });
    }
  }

  // -----------------------------------
  // Add status flags
  // -----------------------------------
  const showsWithStatus = shows.map((show) => {
    const diffMinutes =
      (new Date(show.startTime).getTime() - now.getTime()) / 60000;

    const theatreId = show.screen?.theatre?.id;

    return {
      id: show.id,
      startTime: show.startTime,

      screen: {
        ...show.screen,
        theatre: theatreMap[theatreId],
      },

      hasStarted: diffMinutes <= 0,
      isBookable: diffMinutes > -GRACE_MINUTES,
    };
  });

  // -----------------------------------
  // Response
  // -----------------------------------
  res.json({
    success: true,
    source: "db",
    shows: showsWithStatus,
  });
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
    throw new AppError(
      "movieId, screenId, startTime, seatPrice are required",
      400
    );
  }

  const screen = await prisma.screen.findUnique({
    where: { id: screenId },
    select: { id: true, theatreId: true },
  });

  if (!screen) throw new AppError("Screen not found", 404);
  if (!screen.theatreId)
    throw new AppError("Screen not linked to a theatre", 400);

  const movie = await prisma.movie.findUnique({
    where: { id: movieId },
    select: { runtime: true },
  });

  if (!movie || !movie.runtime) {
    throw new AppError("Movie runtime not found", 400);
  }

  const start = new Date(startTime);
  if (isNaN(start.getTime())) {
    throw new AppError("Invalid startTime", 400);
  }

  const endTime = new Date(
    start.getTime() + movie.runtime * 60 * 1000
  );

  const show = await prisma.show.create({
    data: {
      movieId,
      screenId,
      startTime: start,
      endTime,
      seatPrice,
    },
  });

  res.status(201).json({
    success: true,
    show,
  });
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

  if (!theatreId) {
    throw new AppError("theatreId is required", 400);
  }

  const now = new Date();

  // -----------------------------------
  // IST day boundaries → UTC
  // -----------------------------------
  // IST offset
const IST_OFFSET = 330 * 60 * 1000;

// Create IST date first
const istDate = new Date(date + "T00:00:00");

// IST day boundaries
const istStart = new Date(istDate);
istStart.setHours(0, 0, 0, 0);

const istEnd = new Date(istDate);
istEnd.setHours(23, 59, 59, 999);

// Convert to UTC for DB query
const start = new Date(istStart.getTime() - IST_OFFSET);
const end = new Date(istEnd.getTime() - IST_OFFSET);


  const utcStartOfDay = new Date(istStartOfDay.getTime() - IST_OFFSET);
  const utcEndOfDay = new Date(istEndOfDay.getTime() - IST_OFFSET);

  // -----------------------------------
  // Grace window (15 mins)
  // -----------------------------------
  const GRACE_MINUTES = 15;
  const graceStart = new Date(now.getTime() - GRACE_MINUTES * 60 * 1000);

  // -----------------------------------
  // Fetch shows
  // -----------------------------------
  const shows = await prisma.show.findMany({
    where: {
      screen: {
        theatreId: theatreId, // direct FK filter (fast & safe)
      },
      startTime: {
        gte: graceStart,
        lte: utcEndOfDay,
      },
    },
    select: {
      id: true,
      startTime: true,
      seatPrice: true,

      movie: {
        select: {
          id: true,
          title: true,
          posterPath: true,
          runtime: true,
          voteAverage: true,
          releaseDate: true,
          genres: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },

      screen: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { startTime: "asc" },
  });

  // -----------------------------------
  // Add computed status (NO spread)
  // -----------------------------------
  const showsWithStatus = shows.map((show) => {
    const diffMinutes =
      (new Date(show.startTime).getTime() - now.getTime()) / 60000;

    return {
      id: show.id,
      startTime: show.startTime,
      seatPrice: show.seatPrice,
      movie: show.movie,
      screen: show.screen,

      hasStarted: diffMinutes <= 0,
      isBookable: diffMinutes > -GRACE_MINUTES,
    };
  });

  // -----------------------------------
  // Response
  // -----------------------------------
  res.json({
    success: true,
    source: "db",
    shows: showsWithStatus,
  });
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
