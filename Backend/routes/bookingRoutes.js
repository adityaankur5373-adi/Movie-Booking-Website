import express from "express";
import protect from "../middlewares/protect.js";
import adminOnly from "../middlewares/adminOnly.js";

import {
  getMyBookings,
  getAllBookings,
  getBookingById,
  createBooking,
} from "../controller/booking.controller.js";


const router = express.Router();

/* ------------------- SHOW SEAT LOCK SYSTEM ------------------- */

// lock seats

/* ------------------- BOOKINGS ------------------- */

// confirm booking after payment success
router.post("/create", protect, createBooking);
// my bookings

router.get("/me", protect, getMyBookings);

// admin all bookings
router.get("/all", protect, adminOnly, getAllBookings);
router.get("/:bookingId", protect, getBookingById);
export default router;
