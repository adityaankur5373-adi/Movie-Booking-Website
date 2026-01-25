import { Router } from "express";
import protect from "../middlewares/protect.js";
import adminOnly from "../middlewares/adminOnly.js";
import {
  getShowsByMovieAndDate,
  getShowById,
  createShow,
  getShowsByMovie,
  getShowsByTheatre,
  getAllShowsAdmin,
} from "../controller/show.controller.js";

const router = Router();

router.get("/", getShowsByMovieAndDate);

// ✅ put fixed routes first
router.post("/", protect, adminOnly, createShow);
router.get("/all", protect, adminOnly, getAllShowsAdmin);
router.get("/movie/:movieId", getShowsByMovie);
router.get("/theatre/:theatreId", getShowsByTheatre);

// ✅ keep dynamic route last
router.get("/:showId", getShowById);


export default router;
