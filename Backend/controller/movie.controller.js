import pkg from "@prisma/client";
const { PrismaClient } = pkg;

import asyncHandler from "../middlewares/asyncHandler.js";
import AppError from "../utils/AppError.js";

const prisma = new PrismaClient();

// ================================
// GET MOVIES (cursor pagination)
// GET /api/movies?limit=12&cursor=uuid
// ================================
export const getMovies = asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 12, 50);
  const cursor = req.query.cursor || null;

  const movies = await prisma.movie.findMany({
    take: limit + 1,
    ...(cursor && {
      skip: 1,
      cursor: { id: cursor },
    }),
    include: {
      trailers: true,
      casts: true,
      genres: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const hasNextPage = movies.length > limit;
  const data = hasNextPage ? movies.slice(0, limit) : movies;

  res.json({
    success: true,
    movies: data,
    nextCursor: hasNextPage ? data[data.length - 1].id : null,
    hasNextPage,
  });
});

// ================================
// GET MOVIE BY ID
// GET /api/movies/:id
// ================================
export const getMovieById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const movie = await prisma.movie.findUnique({
    where: { id },
    include: { trailers: true, casts: true, genres: true },
  });

  if (!movie) throw new AppError("Movie not found", 404);

  res.json({ success: true, movie });
});

// ================================
// ADMIN: CREATE MOVIE
// POST /api/movies
// ================================
export const createMovie = asyncHandler(async (req, res) => {
  const {
    imdbId,
    title,
    overview,
    posterPath,
    backdropPath,
    releaseDate,
    runtime,
    originalLanguage,
    tagline,
    voteAverage,
    voteCount,
    genres = [],
    trailers = [],
    casts = [],
  } = req.body;

  if (!title?.trim()) throw new AppError("Title is required", 400);

  // ✅ pick preferred language (English if exists else first)
  const langs = (originalLanguage || "")
    .split(",")
    .map((l) => l.trim())
    .filter(Boolean);

  const preferredLanguage = langs.includes("English")
    ? "English"
    : langs[0] || null;

  // avoid duplicates
  const exists = await prisma.movie.findFirst({
    where: {
      OR: [
        imdbId ? { imdbId: imdbId.trim() } : undefined,
        { title: title.trim() },
      ].filter(Boolean),
    },
  });

  if (exists) throw new AppError("Movie already exists", 409);

  // ✅ clean arrays (ONLY names)
  const cleanGenres = Array.isArray(genres)
    ? genres
        .map((g) => ({
          name: (g?.name || "").trim(),
        }))
        .filter((g) => g.name)
    : [];

  const cleanCasts = Array.isArray(casts)
    ? casts
        .map((c) => ({
          name: (c?.name || "").trim(),
          profilePath: c?.profilePath || null,
        }))
        .filter((c) => c.name)
    : [];

  const cleanTrailers = Array.isArray(trailers)
    ? trailers
        .map((t) => ({
          image: t?.image || null,
          videoUrl: (t?.videoUrl || "").trim(),
        }))
        .filter((t) => t.videoUrl)
    : [];

  const movie = await prisma.movie.create({
    data: {
      imdbId: imdbId?.trim() || null,
      title: title.trim(),
      overview: overview || null,
      posterPath: posterPath || null,
      backdropPath: backdropPath || null,
      releaseDate: releaseDate ? new Date(releaseDate) : null,
      runtime: runtime ? Number(runtime) : null,

      originalLanguage: preferredLanguage,
      tagline: tagline || null,
      voteAverage: voteAverage ? Number(voteAverage) : null,
      voteCount: voteCount ? Number(voteCount) : null,

      // ✅ Genres by NAME (no ID required)
      genres: {
        connectOrCreate: cleanGenres.map((g) => ({
          where: { name: g.name }, // name must be unique in schema
          create: { name: g.name },
        })),
      },

      // ✅ Cast by NAME (no ID required)
      casts: {
        connectOrCreate: cleanCasts.map((c) => ({
          where: { name: c.name }, // name must be unique in schema
          create: { name: c.name, profilePath: c.profilePath },
        })),
      },

      // trailers are per-movie (create fresh)
      trailers: {
        create: cleanTrailers.map((t) => ({
          image: t.image,
          videoUrl: t.videoUrl,
        })),
      },
    },
    include: { trailers: true, casts: true, genres: true },
  });

  res.status(201).json({ success: true, movie });
});

// ================================
// ADMIN: UPDATE MOVIE
// PATCH /api/movies/:id
// ================================
export const updateMovie = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const movieExists = await prisma.movie.findUnique({
    where: { id },
    include: { trailers: true, casts: true, genres: true },
  });

  if (!movieExists) throw new AppError("Movie not found", 404);

  const {
    imdbId,
    title,
    overview,
    posterPath,
    backdropPath,
    releaseDate,
    runtime,
    originalLanguage,
    tagline,
    voteAverage,
    voteCount,
    genres,   // optional
    trailers, // optional
    casts,    // optional
  } = req.body;

  // Unique checks
  if (title && title.trim() !== movieExists.title) {
    const titleTaken = await prisma.movie.findUnique({
      where: { title: title.trim() },
    });
    if (titleTaken) throw new AppError("Title already exists", 409);
  }

  if (imdbId && imdbId.trim() !== movieExists.imdbId) {
    const imdbTaken = await prisma.movie.findUnique({
      where: { imdbId: imdbId.trim() },
    });
    if (imdbTaken) throw new AppError("imdbId already exists", 409);
  }

  // clean optional arrays
  const cleanGenres = Array.isArray(genres)
    ? genres
        .map((g) => ({ name: (g?.name || "").trim() }))
        .filter((g) => g.name)
    : null;

  const cleanCasts = Array.isArray(casts)
    ? casts
        .map((c) => ({
          name: (c?.name || "").trim(),
          profilePath: c?.profilePath || null,
        }))
        .filter((c) => c.name)
    : null;

  const cleanTrailers = Array.isArray(trailers)
    ? trailers
        .map((t) => ({
          image: t?.image || null,
          videoUrl: (t?.videoUrl || "").trim(),
        }))
        .filter((t) => t.videoUrl)
    : null;

  const updated = await prisma.movie.update({
    where: { id },
    data: {
      imdbId: imdbId !== undefined ? imdbId?.trim() || null : undefined,
      title: title !== undefined ? title?.trim() : undefined,
      overview: overview !== undefined ? overview : undefined,
      posterPath: posterPath !== undefined ? posterPath : undefined,
      backdropPath: backdropPath !== undefined ? backdropPath : undefined,
      releaseDate:
        releaseDate !== undefined
          ? releaseDate
            ? new Date(releaseDate)
            : null
          : undefined,
      runtime: runtime !== undefined ? (runtime ? Number(runtime) : null) : undefined,

      originalLanguage: originalLanguage !== undefined ? originalLanguage : undefined,
      tagline: tagline !== undefined ? tagline : undefined,
      voteAverage: voteAverage !== undefined ? (voteAverage ? Number(voteAverage) : null) : undefined,
      voteCount: voteCount !== undefined ? (voteCount ? Number(voteCount) : null) : undefined,

      // ✅ Replace genres if provided (many-to-many)
      ...(cleanGenres && {
        genres: {
          set: [], // remove old links
          connectOrCreate: cleanGenres.map((g) => ({
            where: { name: g.name },
            create: { name: g.name },
          })),
        },
      }),

      // ✅ Replace casts if provided (many-to-many)
      ...(cleanCasts && {
        casts: {
          set: [], // remove old links
          connectOrCreate: cleanCasts.map((c) => ({
            where: { name: c.name },
            create: { name: c.name, profilePath: c.profilePath },
          })),
        },
      }),

      // ✅ Replace trailers if provided (trailers belong to movie)
      ...(cleanTrailers && {
        trailers: {
          deleteMany: {}, // delete old trailers of this movie
          create: cleanTrailers.map((t) => ({
            image: t.image,
            videoUrl: t.videoUrl,
          })),
        },
      }),
    },
    include: { trailers: true, casts: true, genres: true },
  });

  res.json({ success: true, movie: updated });
});

// ================================
// ADMIN: DELETE MOVIE
// DELETE /api/movies/:id
// ================================
export const deleteMovie = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const movie = await prisma.movie.findUnique({
    where: { id },
  });

  if (!movie) throw new AppError("Movie not found", 404);

  // ✅ block delete if shows exist
  const showCount = await prisma.show.count({
    where: { movieId: id },
  });

  if (showCount > 0) {
    throw new AppError(
      "Cannot delete movie because shows are already created for it",
      400
    );
  }

  await prisma.movie.delete({ where: { id } });

  res.json({ success: true, message: "Movie deleted successfully" });
});

// ================================
// GET FEATURED MOVIES
// GET /api/movies/featured?limit=4
// ================================
export const getFeaturedMovies = asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 4, 20);

  const movies = await prisma.movie.findMany({
    take: limit,
    include: {
      trailers: true,
      casts: true,
      genres: true,
    },
    orderBy: { createdAt: "desc" },
  });

  res.json({ success: true, movies });
});
 //getAllmovies //admin
 export const getAllmovies = async (req, res) => {
  try {
    const movies = await prisma.movie.findMany({
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({
      success: true,
      movies,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
