import { Router } from "express";
import protect from "../middlewares/protect.js";
import adminOnly from "../middlewares/adminOnly.js";

import {
  getMovies,
  getMovieById,
  createMovie,
  updateMovie,
  getFeaturedMovies,
  deleteMovie,
  getAllmovies,
} from "../controller/movie.controller.js";

const router = Router();
router.get("/featured", getFeaturedMovies);
router.get("/", getMovies);
router.get("/now-playing", getAllmovies);
router.get("/:id", getMovieById);
router.post("/", protect, adminOnly, createMovie);
router.patch("/:id", protect, adminOnly, updateMovie);
router.delete("/:id", protect, adminOnly, deleteMovie);

export default router;
