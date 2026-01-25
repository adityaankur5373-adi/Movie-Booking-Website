import pkg from "@prisma/client";
const { PrismaClient } = pkg;

import asyncHandler from "../middlewares/asyncHandler.js";
import AppError from "../utils/AppError.js";

import redis from "../config/redis.js"; // ✅ add this

const prisma = new PrismaClient();

// =====================================
// ✅ Resume-ready Cache Versioning (Theatres)
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
const theatresListKey = (version) => `theatres:v${version}:list`;
const theatreDetailsKey = (version, id) => `theatres:v${version}:details:${id}`;

/**
 * GET /api/theatres
 * Public: list theatres (with screen count)
 */
export const getTheatres = asyncHandler(async (req, res) => {
  const version = await getTheatresCacheVersion();
  const cacheKey = theatresListKey(version);

  // ✅ cache check (5 min)
  const cached = await redis.get(cacheKey);
  if (cached) {
    return res.json({
      success: true,
      source: "cache",
      theatres: JSON.parse(cached),
    });
  }

  const theatres = await prisma.theatre.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: { screenList: true },
      },
    },
  });

  await redis.set(cacheKey, JSON.stringify(theatres), "EX", 300);

  res.json({ success: true, source: "db", theatres });
});

/**
 * GET /api/theatres/:id
 * Public: get single theatre (with screens + screen count)
 */
export const getTheatreById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const version = await getTheatresCacheVersion();
  const cacheKey = theatreDetailsKey(version, id);

  // ✅ cache check (10 min)
  const cached = await redis.get(cacheKey);
  if (cached) {
    return res.json({
      success: true,
      source: "cache",
      theatre: JSON.parse(cached),
    });
  }

  const theatre = await prisma.theatre.findUnique({
    where: { id },
    include: {
      screenList: true,
      _count: {
        select: { screenList: true },
      },
    },
  });

  if (!theatre) throw new AppError("Theatre not found", 404);

  await redis.set(cacheKey, JSON.stringify(theatre), "EX", 600);

  res.json({ success: true, source: "db", theatre });
});

/**
 * POST /api/theatres
 * ADMIN: create theatre
 */
export const createTheatre = asyncHandler(async (req, res) => {
  const { name, city, area, address } = req.body;

  if (!name || !city) throw new AppError("name and city are required", 400);

  const theatre = await prisma.theatre.create({
    data: { name, city, area, address },
  });

  // ✅ invalidate theatre cache
  await bumpTheatresCacheVersion();

  res.status(201).json({ success: true, theatre });
});

/**
 * POST /api/theatres/:theatreId/screens
 * ADMIN: add screen with layout JSON
 */
export const addScreenToTheatre = asyncHandler(async (req, res) => {
  const { theatreId } = req.params;
  const { name, screenNo, layout } = req.body;

  if (!name || screenNo === undefined || !layout) {
    throw new AppError("name, screenNo, layout are required", 400);
  }

  const theatre = await prisma.theatre.findUnique({
    where: { id: theatreId },
  });

  if (!theatre) throw new AppError("Theatre not found", 404);

  const screen = await prisma.screen.create({
    data: {
      name,
      screenNo: Number(screenNo),
      layout,
      theatreId,
    },
  });

  // ✅ invalidate theatre cache (because screens changed)
  await bumpTheatresCacheVersion();

  res.status(201).json({ success: true, screen });
});