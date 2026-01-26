import Stripe from "stripe";
import asyncHandler from "../middlewares/asyncHandler.js";
import AppError from "../utils/AppError.js";
import redis from "../config/redis.js";
import { prisma } from "../config/prisma.js";
import { calcTotalFromLayout } from "../utils/calcTotal.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const LOCK_TTL_SECONDS = 300;
const lockKey = (showId) => `lock:show:${showId}`;
  export const createPaymentIntent = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const { bookingId, skipLock } = req.body; // ✅ updated

  if (!bookingId) throw new AppError("bookingId is required", 400);

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      show: {
        include: {
          screen: true,
          movie: true,
        },
      },
    },
  });

  if (!booking) throw new AppError("Booking not found", 404);
  if (booking.userId !== userId) throw new AppError("Not allowed", 403);

  if (booking.isPaid) {
    return res.status(200).json({
      success: true,
      message: "Booking already paid",
      clientSecret: null,
      amount: booking.totalAmount,
      ttlSeconds: LOCK_TTL_SECONDS,
    });
  }

  const showId = booking.showId;
  const seats = booking.bookedSeats;

  if (!showId) throw new AppError("showId missing in booking", 400);
  if (!seats || seats.length === 0) throw new AppError("No seats in booking", 400);

  // ✅ only check lock when skipLock is false
  if (!skipLock) {
    const key = lockKey(showId);

    for (const seat of seats) {
      const lockedBy = await redis.hget(key, seat);
      if (lockedBy !== userId) {
        throw new AppError(`Seat ${seat} is not locked by you`, 409);
      }
    }
  }

  const amount = calcTotalFromLayout(booking.show.screen.layout, seats);

  if (amount <= 0) throw new AppError("Invalid amount", 400);

  const paymentIntent = await stripe.paymentIntents.create({
    amount: amount * 100,
    currency: "inr",
    metadata: {
      userId,
      showId,
      bookingId,
      seats: JSON.stringify(seats),
      movieTitle: booking.show.movie?.title || "",
    },
  });

  return res.json({
    success: true,
    clientSecret: paymentIntent.client_secret,
    amount,
    ttlSeconds: LOCK_TTL_SECONDS,
  });
});