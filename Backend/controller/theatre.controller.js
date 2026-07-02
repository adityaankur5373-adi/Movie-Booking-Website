import { prisma } from "../config/prisma.js";
import asyncHandler from "../middlewares/asyncHandler.js";
import AppError from "../utils/AppError.js";
import redis from "../config/redis.js";

// =====================================
// ✅ Cache Versioning (Theatres)
// =====================================
const THEATRES_CACHE_VERSION_KEY = "theatres:cache:version";

const getTheatresCacheVersion = async () => {
  const v = await redis.get(THEATRES_CACHE_VERSION_KEY);
  if (!v) {
    await redis.set(THEATRES_CACHE_VERSION_KEY, "1");
    return "1";
  }
  return v;
};

const bumpTheatresCacheVersion = async () => {
  await redis.incr(THEATRES_CACHE_VERSION_KEY);
};

// =====================================
// Cache Key Helpers
// =====================================
const theatresListKey = (version, city) =>
  `theatres:v${version}:list:city=${city || "all"}`;

const theatreDetailsKey =
  (version, city, id) =>
    `theatres:v${version}:details:${city}:${id}`;

// =====================================
// GET /api/theatres?city=Delhi
// Public: list theatres (with screen count)
// =====================================
export const getTheatres = asyncHandler(async (req, res) => {
  const city = req.cookies.selectedCity;

  if (!city) {
    throw new AppError("Please select a city", 400);
  }

  const version = await getTheatresCacheVersion();
  const cacheKey = theatresListKey(version, city);

  const cached = await redis.get(cacheKey);

  if (cached) {
    return res.json({
      success: true,
      source: "cache",
      theatres: JSON.parse(cached),
    });
  }

  const theatres = await prisma.theatre.findMany({
    where: {
      city,
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      name: true,
      city: true,
      area: true,
      address: true,
      createdAt: true,

      _count: {
        select: {
          screenList: true,
        },
      },
    },
  });

  await redis.set(cacheKey, JSON.stringify(theatres), "EX", 300);

  res.json({
    success: true,
    source: "db",
    theatres,
  });
});
// =====================================
// GET /api/theatres/:id
// Public: get single theatre
// NOTE: screenList can be heavy because layout JSON is big
// =====================================
export const getTheatreById = asyncHandler(async (req, res) => {
  const { theatreId } = req.params;
   if (!theatreId) {
    throw new AppError("theatreId is required", 400);
  }

  const city = req.cookies.selectedCity;

  if (!city) {
    throw new AppError("Please select a city", 400);
  }
  const version = await getTheatresCacheVersion();
  const cacheKey = theatreDetailsKey(
    version,
    city,
    theatreId
);

  const cached = await redis.get(cacheKey);
  if (cached) {
    return res.json({
      success: true,
      source: "cache",
      theatre: JSON.parse(cached),
    });
  }

  const theatre = await prisma.theatre.findFirst({
    where: {
      id: theatreId,
      city,
    },
    select: {
      id: true,
      name: true,
      city: true,
      area: true,
      address: true,
      createdAt: true,
      _count: {
        select: { screenList: true },
      },

      // ✅ screens info (but avoid layout for speed)
      screenList: {
        select: {
          id: true,
          name: true,
          screenNo: true,
          createdAt: true,
        },
        orderBy: { screenNo: "asc" },
      },
    },
  });

  if (!theatre) throw new AppError("Theatre not found", 404);

  await redis.set(cacheKey, JSON.stringify(theatre), "EX", 600);

  res.json({ success: true, source: "db", theatre });
});

// =====================================
// POST /api/theatres
// ADMIN: create theatre
// =====================================
export const createTheatre = asyncHandler(async (req, res) => {
  const {
  name,
  city,
  area,
  address,
  latitude,
  longitude,
} = req.body;

  if (
  !name?.trim() ||
  !city?.trim() ||
  latitude === undefined ||
  longitude === undefined
) {
  throw new AppError(
    "name, city, latitude and longitude are required",
    400
  );
}

 const theatre = await prisma.theatre.create({
  data: {
    name: name.trim(),
    city: city.trim(),
    area: area?.trim() || null,
    address: address?.trim() || null,

    latitude: Number(latitude),
    longitude: Number(longitude),
  },
});

  await bumpTheatresCacheVersion();

  res.status(201).json({ success: true, theatre });
});

// =====================================
// POST /api/theatres/:theatreId/screens
// ADMIN: add screen with layout JSON
// =====================================
export const addScreenToTheatre = asyncHandler(async (req, res) => {
    console.log("🔥 HIT getTheatreById", req.params);
  const  {theatreId}  = req.params;
  const { name, screenNo, layout } = req.body;

  if (!name?.trim() || screenNo === undefined || !layout) {
    throw new AppError("name, screenNo, layout are required", 400);
  }

  const theatre = await prisma.theatre.findUnique({
    where: { id: theatreId },
    select: { id: true },
  });

  if (!theatre) throw new AppError("Theatre not found", 404);

  // optional: prevent duplicate screenNo per theatre
  const exists = await prisma.screen.findFirst({
    where: {
      theatreId,
      screenNo: Number(screenNo),
    },
    select: { id: true },
  });

  if (exists) {
    throw new AppError(`ScreenNo ${screenNo} already exists in this theatre`, 409);
  }

  const screen = await prisma.screen.create({
    data: {
      name: name.trim(),
      screenNo: Number(screenNo),
      layout,
      theatreId,
    },
    select: {
      id: true,
      name: true,
      screenNo: true,
      theatreId: true,
      createdAt: true,
    },
  });

  await bumpTheatresCacheVersion();

  res.status(201).json({ success: true, screen });
});