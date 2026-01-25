import express from "express";
import protect from "../middlewares/protect.js";
import adminOnly from "../middlewares/adminOnly.js";

import {
  confirmBooking,
  getMyBookings,
  getAllBookings,
  getBookingById
} from "../controller/booking.controller.js";

import {
  lockSeats,
  unlockSeats,
  getShowById,
} from "../controller/show.controller.js";

const router = express.Router();

/* ------------------- SHOW SEAT LOCK SYSTEM ------------------- */

// lock seats
router.post("/shows/:showId/lock", protect, lockSeats);

// unlock seats
router.post("/shows/:showId/unlock", protect, unlockSeats);

// get show details (includes bookedSeats + lockedSeats)
router.get("/shows/:showId", protect, getShowById);

/* ------------------- BOOKINGS ------------------- */

// confirm booking after payment success
router.post("/bookings/confirm", protect, confirmBooking);

// my bookings
router.get("/bookings/me", protect, getMyBookings);

// admin all bookings
router.get("/bookings/all", protect, adminOnly, getAllBookings);
router.get("/bookings/:id", protect, getBookingById);
export default router;
