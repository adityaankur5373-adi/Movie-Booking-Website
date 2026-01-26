import { Router } from "express";
import protect from "../middlewares/protect.js";
import adminOnly from "../middlewares/adminOnly.js";
import {
  getShowsByMovieAndDate,
  createShow,
  getShowsByMovie,
  getShowsByTheatre,
  getAllShowsAdmin,
   lockSeats,
    unlockSeats,
    getShowById,
} from "../controller/show.controller.js";

const router = Router();

router.get("/", getShowsByMovieAndDate);

// ✅ put fixed routes first
router.post("/", protect, adminOnly, createShow);
router.get("/all", protect, adminOnly, getAllShowsAdmin);
router.get("/movie/:movieId", getShowsByMovie);
router.get("/theatre/:theatreId", getShowsByTheatre);
router.post("/:showId/lock", protect, lockSeats);

// unlock seats
router.post("/:showId/unlock", protect, unlockSeats);

// get show details (includes bookedSeats + lockedSeats)
router.get("/:showId", getShowById);



export default router;
