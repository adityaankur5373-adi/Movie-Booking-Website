import { Router } from "express";
import protect from "../middlewares/protect.js";
import adminOnly from "../middlewares/adminOnly.js";
import {
  getTheatres,
  getTheatreById,
  createTheatre,
  addScreenToTheatre,
} from "../controller/theatre.controller.js";

const router = Router();

router.get("/", getTheatres);
router.get("/:theatreId", getTheatreById);
router.post("/", protect, adminOnly, createTheatre);
router.post("/:theatreId/screens", protect, adminOnly, addScreenToTheatre);

export default router;
