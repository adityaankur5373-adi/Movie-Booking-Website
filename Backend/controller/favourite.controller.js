// change path if different
import pkg from "@prisma/client";
const { PrismaClient } = pkg;

import asyncHandler from "../middlewares/asyncHandler.js";
import AppError from "../utils/AppError.js";

const prisma = new PrismaClient();

// ✅ POST /api/favourites
// body: { movieId }
export const addFavourite = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { movieId } = req.body;

  if (!movieId) {
    return res.status(400).json({ success: false, message: "movieId required" });
  }

  const favourite = await prisma.favourite.upsert({
    where: {
      userId_movieId: { userId, movieId },
    },
    update: {},
    create: { userId, movieId },
  });

  res.status(201).json({
    success: true,
    message: "Added to favourites",
    favourite,
  });
});

// ✅ DELETE /api/favourites/:movieId
export const removeFavourite = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { movieId } = req.params;

  if (!movieId) {
    return res.status(400).json({ success: false, message: "movieId required" });
  }

  await prisma.favourite.delete({
    where: {
      userId_movieId: { userId, movieId },
    },
  });

  res.json({ success: true, message: "Removed from favourites" });
});

// ✅ GET /api/favourites/:movieId
export const checkFavourite = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { movieId } = req.params;

  const fav = await prisma.favourite.findUnique({
    where: {
      userId_movieId: { userId, movieId },
    },
  });

  res.json({ success: true, isFavourite: !!fav });
});

// ✅ GET /api/favourites
export const getMyFavourites = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const favs = await prisma.favourite.findMany({
    where: { userId },
    include: {
      movie: {
        include: {
          genres: true, // ✅ correct (your Movie model has genres)
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const movies = favs.map((f) => f.movie);

  res.json({ success: true, favourites: movies });
});

