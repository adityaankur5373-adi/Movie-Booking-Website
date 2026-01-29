import { prisma } from "../config/prisma.js";
import asyncHandler from "../middlewares/asyncHandler.js";
import AppError from "../utils/AppError.js";
import redis from "../config/redis.js";
const lockKey = (showId) => `lock:show:${showId}`;

// =====================================
// ✅ Cache Versioning (Shows)
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

  const start = new Date(`${date}T00:00:00`);
  const end = new Date(`${date}T23:59:59.999`);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new AppError("Invalid date format. Use YYYY-MM-DD", 400);
  }

  const version = await getShowsCacheVersion();
  const cacheKey = showsByMovieAndDateKey(version, movieId, date);

  const cached = await redis.get(cacheKey);
  if (cached) {
    return res.json({
      success: true,
      source: "cache",
      shows: JSON.parse(cached),
    });
  }

  const now = new Date();

  const REMOVE_AFTER_MINUTES = 15;
  const removeAfter = new Date(
    now.getTime() - REMOVE_AFTER_MINUTES * 60 * 1000
  );

  const shows = await prisma.show.findMany({
    where: {
      movieId,
      startTime: {
        gte: removeAfter,
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

  // 🟢 BUILD screenList PER THEATRE
  const theatreMap = {};

  for (const show of shows) {
    const theatre = show.screen.theatre;
    const theatreId = theatre.id;

    if (!theatreMap[theatreId]) {
      theatreMap[theatreId] = {
        ...theatre,
        screenList: [],
      };
    }

    // add unique screens
    if (
      !theatreMap[theatreId].screenList.some(
        (s) => s.id === show.screen.id
      )
    ) {
      theatreMap[theatreId].screenList.push({
        id: show.screen.id,
        name: show.screen.name,
      });
    }
  }

  // 🟢 attach screenList + runtime flags
  const showsWithStatus = shows.map((show) => {
    const theatreId = show.screen.theatre.id;

    return {
      ...show,
      screen: {
        ...show.screen,
        theatre: theatreMap[theatreId],
      },
      hasStarted: now >= show.startTime,
      isBookable: now < show.startTime,
    };
  });

  await redis.set(
    cacheKey,
    JSON.stringify(showsWithStatus),
    "EX",
    30
  );

  return res.json({
    success: true,
    source: "db",
    shows: showsWithStatus,
  });
});
// =====================================
// GET /api/shows/:showId  (SeatLayout page)
// =====================================
export const getShowById = asyncHandler(async (req, res) => {
  const { showId } = req.params;

  // ========================
  // 1️⃣ Cache static show data
  // ========================
  const version = await getShowsCacheVersion();
  const cacheKey = showBaseKey(version, showId);

  let baseShow;
  const cached = await redis.get(cacheKey);

  if (cached) {
    baseShow = JSON.parse(cached);
  } else {
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

    baseShow = {
      id: show.id,
      startTime: show.startTime,
      seatPrice: show.seatPrice,
      movie: show.movie,
      screen: show.screen,
      theatre: show.screen.theatre,
    };

    // cache ONLY static data
    await redis.set(cacheKey, JSON.stringify(baseShow), "EX", 60);
  }

  // ========================
  // 2️⃣ BOOKED seats ONLY (DB is truth)
  // ========================
  const bookingRows = await prisma.booking.findMany({
    where: {
      showId,
      status: "CONFIRMED",
    },
    select: {
      bookedSeats: true,
    },
  });

  const bookedSeats = bookingRows.flatMap((b) => b.bookedSeats);

  // ========================
  // 3️⃣ Response (NO locked seats)
  // ========================
  res.json({
    success: true,
    source: cached ? "cache+dbSeats" : "db+dbSeats",
    show: {
      ...baseShow,
      bookedSeats, // 🔴 permanently unavailable
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

  // 1️⃣ Validate screen
  const screen = await prisma.screen.findUnique({
    where: { id: screenId },
    select: { id: true },
  });

  if (!screen) {
    throw new AppError("Screen not found", 404);
  }

  // 2️⃣ Fetch movie runtime
  const movie = await prisma.movie.findUnique({
    where: { id: movieId },
    select: { runtime: true },
  });

  if (!movie || !movie.runtime) {
    throw new AppError("Movie runtime not found", 400);
  }

  // 3️⃣ Calculate startTime & endTime
 const start = new Date(`${startTime}+05:30`);

  if (isNaN(start.getTime())) {
    throw new AppError("Invalid startTime", 400);
  }

  const endTime = new Date(
    start.getTime() + movie.runtime * 60 * 1000
  );

  // (Optional) add cleaning / buffer time
  // endTime.setMinutes(endTime.getMinutes() + 15);

  // 4️⃣ Create show with endTime
  const show = await prisma.show.create({
    data: {
      movieId,
      screenId,
      startTime: start,
      endTime, // ✅ REQUIRED now
      seatPrice,
    },
  });

  // 5️⃣ Invalidate show caches
  await bumpShowsCacheVersion();

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

  const version = await getShowsCacheVersion();
  const cacheKey = showsByMovieKey(version, movieId);

  const cached = await redis.get(cacheKey);
  if (cached) {
    return res.json({
      success: true,
      source: "cache",
      shows: JSON.parse(cached),
    });
  }

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

  await redis.set(cacheKey, JSON.stringify(shows), "EX", 30);

  res.json({ success: true, source: "db", shows });
});
// =====================================
// GET /api/shows/theatre/:theatreId
export const getShowsByTheatre = asyncHandler(async (req, res) => {
  const { theatreId } = req.params;
  if (!theatreId) throw new AppError("theatreId is required", 400);

  const version = await getShowsCacheVersion();

  // ===== CURRENT TIME (UTC) =====
  const now = new Date();

  // ===== IST DAY BOUNDARIES =====
  const IST_OFFSET = 330 * 60 * 1000; // +5:30

  const istNow = new Date(now.getTime() + IST_OFFSET);

  const istStartOfDay = new Date(istNow);
  istStartOfDay.setHours(0, 0, 0, 0);

  const istEndOfDay = new Date(istNow);
  istEndOfDay.setHours(23, 59, 59, 999);

  // convert IST → UTC (DB is UTC)
  const utcStartOfDay = new Date(istStartOfDay.getTime() - IST_OFFSET);
  const utcEndOfDay = new Date(istEndOfDay.getTime() - IST_OFFSET);

  // ===== CACHE KEY (date based) =====
  const todayStr = istStartOfDay.toISOString().slice(0, 10);
  const cacheKey = showsByTheatreKey(version, theatreId, todayStr);

  const cached = await redis.get(cacheKey);
  if (cached) {
    return res.json({
      success: true,
      source: "cache",
      shows: JSON.parse(cached),
    });
  }

  // ===== GRACE PERIOD (15 min after start) =====
  const GRACE_MINUTES = 15;
  const graceStart = new Date(now.getTime() - GRACE_MINUTES * 60 * 1000);

  // ===== DB QUERY (TODAY ONLY) =====
  const shows = await prisma.show.findMany({
    where: {
      screen: { is: { theatreId } },
      startTime: {
        gte: utcStartOfDay,
        lte: utcEndOfDay,
        not: { lt: graceStart }, // remove expired shows
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
          genres: { select: { id: true, name: true } },
          voteAverage: true,
          voteCount: true,
          releaseDate: true,
          runtime: true,
        },
      },
      screen: {
        select: {
          id: true,
          name: true,
          layout: true,
        },
      },
    },
    orderBy: { startTime: "asc" },
  });

  // ===== RUNTIME FLAGS (NOT STORED) =====
  const showsWithStatus = shows.map((show) => ({
    ...show,
    hasStarted: now >= show.startTime,
    isBookable: now < show.startTime, // booking closes at start
  }));

  // ===== CACHE FINAL RESPONSE =====
  await redis.set(cacheKey, JSON.stringify(showsWithStatus), "EX", 10);

  return res.json({
    success: true,
    source: "db",
    shows: showsWithStatus,
  });
});
// =====================================
// =====================================


const getShowStatus = (now, startTime, endTime) => {
  if (now < startTime) return "UPCOMING";
  if (now >= startTime && now <= endTime) return "RUNNING";
  return "ENDED";
};

const getTotalSeatsFromLayout = (layout) => {
  if (!layout?.rows) return 0;
  return layout.rows.reduce((sum, row) => sum + row.seats.length, 0);
};
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

  const now = new Date();

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
          layout: true,
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
      _count: {
        select: { bookings: true },
      },
    },
    orderBy: [{ startTime: "desc" }, { id: "desc" }],
  });

  const hasNextPage = shows.length > limit;
  const data = hasNextPage ? shows.slice(0, limit) : shows;

  const showIds = data.map((s) => s.id);

  // 🔥 Earnings aggregation
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
      id: true,
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

  const formatted = data.map((s) => {
    const runtime = s.movie?.runtime || 0;
    const endTime = new Date(
      s.startTime.getTime() + runtime * 60 * 1000
    );

    const totalSeats = getTotalSeatsFromLayout(s.screen?.layout);
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
        totalSeats,
        ticketsSold: sold,
        availableSeats: Math.max(totalSeats - sold, 0),
      },

      earnings: {
        amount: earningsMap.get(s.id)?.earnings || 0,
        currency: "INR",
      },

      canEdit: now < s.startTime,
    };
  });

  const responseData = {
    shows: formatted,
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