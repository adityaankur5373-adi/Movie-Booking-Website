import pkg from "@prisma/client";
const { PrismaClient } = pkg;

import asyncHandler from "../middlewares/asyncHandler.js";
import AppError from "../utils/AppError.js";

const prisma = new PrismaClient();

/**
 * GET /api/theatres
 * Public: list theatres (with screen count)
 */
export const getTheatres = asyncHandler(async (req, res) => {
  const theatres = await prisma.theatre.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: { screenList: true }, // ✅ screen count
      },
    },
  });

  res.json({ success: true, theatres });
});

/**
 * GET /api/theatres/:id
 * Public: get single theatre (with screens + screen count)
 */
export const getTheatreById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const theatre = await prisma.theatre.findUnique({
    where: { id },
    include: {
      screenList: true, // ✅ all screens
      _count: {
        select: { screenList: true }, // ✅ count
      },
    },
  });

  if (!theatre) throw new AppError("Theatre not found", 404);

  res.json({ success: true, theatre });
});

/**
 * POST /api/theatres
 * ADMIN: create theatre (NO screens field stored)
 */
export const createTheatre = asyncHandler(async (req, res) => {
  const { name, city, area, address } = req.body;

  if (!name || !city) throw new AppError("name and city are required", 400);

  const theatre = await prisma.theatre.create({
    data: { name, city, area, address },
  });

  res.status(201).json({ success: true, theatre });
});

/**
 * POST /api/theatres/:theatreId/sceens
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

  res.status(201).json({ success: true, screen });
});
