import { prisma } from "../config/prisma.js";
import asyncHandler from "../middlewares/asyncHandler.js";
import AppError from "../utils/AppError.js";

import redis from "../config/redis.js"; // ✅ your redis client


// =====================================
// ✅ Resume-ready Redis Cache Versioning
// =====================================
const MOVIES_CACHE_VERSION_KEY = "movies:cache:version";

const getMoviesCacheVersion = async () => {
  const v = await redis.get(MOVIES_CACHE_VERSION_KEY);
  if (!v) {
    await redis.set(MOVIES_CACHE_VERSION_KEY, "1");
    return "1";
  }
  return v;
};

const bumpMoviesCacheVersion = async () => {
  await redis.incr(MOVIES_CACHE_VERSION_KEY);
};

// =====================================
// Cache Key Helpers
// =====================================
const movieListCacheKey = (version, limit, cursor) =>
  `movies:v${version}:list:limit=${limit}:cursor=${cursor || "null"}`;

const movieDetailsCacheKey = (version, id) => `movies:v${version}:details:${id}`;

const featuredMoviesCacheKey = (version, limit) =>
  `movies:v${version}:featured:limit=${limit}`;

const adminAllMoviesCacheKey = (version) => `movies:v${version}:admin:all`;

// ================================
// GET MOVIES (cursor pagination)
// GET /api/movies?limit=12&cursor=uuid
// ================================
export const getMovies = asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 12, 50);
  const cursor = req.query.cursor || null;

  const version = await getMoviesCacheVersion();
  const cacheKey = movieListCacheKey(version, limit, cursor);

  // ✅ 1) Cache check
  const cached = await redis.get(cacheKey);
  if (cached) {
    return res.json({
      success: true,
      source: "cache",
      ...JSON.parse(cached),
    });
  }

  // ✅ 2) DB fetch
  const movies = await prisma.movie.findMany({
    take: limit + 1,
    ...(cursor && {
      skip: 1,
      cursor: { id: cursor },
    }),
      select: {
    id: true,
    title: true,
    posterPath: true,
    releaseDate: true,
    runtime: true,
    voteAverage: true,

    // if you want genres only (light)
    genres: {
      select: { id: true, name: true },
    },
  },
    orderBy: { createdAt: "desc" },
  });

  const hasNextPage = movies.length > limit;
  const data = hasNextPage ? movies.slice(0, limit) : movies;

  const responseData = {
    movies: data,
    nextCursor: hasNextPage ? data[data.length - 1].id : null,
    hasNextPage,
  };

  // ✅ 3) Save cache (TTL 60 sec)
  await redis.set(cacheKey, JSON.stringify(responseData), "EX", 300);

  return res.json({
    success: true,
    source: "db",
    ...responseData,
  });
});

// ================================
// GET MOVIE BY ID
// GET /api/movies/:id
// ================================
export const getMovieById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const version = await getMoviesCacheVersion();
  const cacheKey = movieDetailsCacheKey(version, id);

  // ✅ 1) Cache check
  const cached = await redis.get(cacheKey);
  if (cached) {
    return res.json({
      success: true,
      source: "cache",
      movie: JSON.parse(cached),
    });
  }

  // ✅ 2) DB fetch
  const movie = await prisma.movie.findUnique({
    where: { id },
    include: { trailers: true, casts: true, genres: true },
  });

  if (!movie) throw new AppError("Movie not found", 404);

  // ✅ 3) Save cache (TTL 5 min)
  await redis.set(cacheKey, JSON.stringify(movie), "EX", 300);

  res.json({ success: true, source: "db", movie });
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

  // ✅ clean arrays
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

      genres: {
        connectOrCreate: cleanGenres.map((g) => ({
          where: { name: g.name },
          create: { name: g.name },
        })),
      },

      casts: {
        connectOrCreate: cleanCasts.map((c) => ({
          where: { name: c.name },
          create: { name: c.name, profilePath: c.profilePath },
        })),
      },

      trailers: {
        create: cleanTrailers.map((t) => ({
          image: t.image,
          videoUrl: t.videoUrl,
        })),
      },
    },
    include: { trailers: true, casts: true, genres: true },
  });

  // ✅ bump cache version (invalidates all old cache)
  await bumpMoviesCacheVersion();

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
    genres,
    trailers,
    casts,
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
      runtime:
        runtime !== undefined ? (runtime ? Number(runtime) : null) : undefined,

      originalLanguage:
        originalLanguage !== undefined ? originalLanguage : undefined,
      tagline: tagline !== undefined ? tagline : undefined,
      voteAverage:
        voteAverage !== undefined
          ? voteAverage
            ? Number(voteAverage)
            : null
          : undefined,
      voteCount:
        voteCount !== undefined
          ? voteCount
            ? Number(voteCount)
            : null
          : undefined,

      ...(cleanGenres && {
        genres: {
          set: [],
          connectOrCreate: cleanGenres.map((g) => ({
            where: { name: g.name },
            create: { name: g.name },
          })),
        },
      }),

      ...(cleanCasts && {
        casts: {
          set: [],
          connectOrCreate: cleanCasts.map((c) => ({
            where: { name: c.name },
            create: { name: c.name, profilePath: c.profilePath },
          })),
        },
      }),

      ...(cleanTrailers && {
        trailers: {
          deleteMany: {},
          create: cleanTrailers.map((t) => ({
            image: t.image,
            videoUrl: t.videoUrl,
          })),
        },
      }),
    },
    include: { trailers: true, casts: true, genres: true },
  });

  // ✅ bump cache version
  await bumpMoviesCacheVersion();

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

  // ✅ bump cache version
  await bumpMoviesCacheVersion();

  res.json({ success: true, message: "Movie deleted successfully" });
});

// ================================
// GET FEATURED MOVIES
// GET /api/movies/featured?limit=4
// ================================
export const getFeaturedMovies = asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 4, 20);

  const version = await getMoviesCacheVersion();
  const cacheKey = featuredMoviesCacheKey(version, limit);

  const cached = await redis.get(cacheKey);
  if (cached) {
    return res.json({
      success: true,
      source: "cache",
      movies: JSON.parse(cached),
    });
  }

 const movies = await prisma.movie.findMany({
  take: limit,
  select: {
    id: true,
    title: true,
    posterPath: true,
    voteAverage: true,
    genres: { select: { id: true, name: true } },
  },
  orderBy: { createdAt: "desc" },
});

  // TTL 2 min
  await redis.set(cacheKey, JSON.stringify(movies), "EX", 120);

  res.json({ success: true, source: "db", movies });
});

// ================================
// GET ALL MOVIES (ADMIN)
// GET /api/movies/all
// ================================
export const getAllmovies = asyncHandler(async (req, res) => {
  const version = await getMoviesCacheVersion();
  const cacheKey = adminAllMoviesCacheKey(version);

  const cached = await redis.get(cacheKey);
  if (cached) {
    return res.status(200).json({
      success: true,
      source: "cache",
      movies: JSON.parse(cached),
    });
  }

  const movies = await prisma.movie.findMany({
  select: {
    id: true,
    title: true,
    posterPath: true,
     voteAverage:true,
     voteCount:true,
    createdAt: true,
  },
  orderBy: { createdAt: "desc" },
});

  await redis.set(cacheKey, JSON.stringify(movies), "EX", 60);

  res.status(200).json({
    success: true,
    source: "db",
    movies,
  });
});