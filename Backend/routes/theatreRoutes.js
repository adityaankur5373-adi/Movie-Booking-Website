import { Router } from "express";
import protect from "../middlewares/protect.js";
import adminOnly from "../middlewares/adminOnly.js";
import {
  getTheatres,
  getTheatreById,
  createTheatre,
  addScreenToTheatre,
  getTheatreNamesAdmin,
} from "../controller/theatre.controller.js";

const router = Router();

router.get("/", getTheatres);
router.get(
  "/admin/all",
  protect,
  adminOnly,
  getTheatreNamesAdmin);
router.get("/:theatreId", getTheatreById);
router.post("/", protect, adminOnly, createTheatre);
router.post("/:theatreId/screens", protect, adminOnly, addScreenToTheatre);

export default router;
