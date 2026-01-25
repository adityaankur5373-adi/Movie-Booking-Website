import Stripe from "stripe";
import asyncHandler from "../middlewares/asyncHandler.js";
import AppError from "../utils/AppError.js";
import redis from "../config/redis.js";
import pkg from "@prisma/client";
const { PrismaClient } = pkg;

const prisma = new PrismaClient();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const LOCK_TTL_SECONDS = 300;
const lockKey = (showId) => `lock:show:${showId}`;

export const createPaymentIntent = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { showId, seats } = req.body;

  if (!showId) throw new AppError("showId is required", 400);
  if (!seats || !Array.isArray(seats) || seats.length === 0) {
    throw new AppError("seats array is required", 400);
  }

  // ✅ Check show exists + layout
  const show = await prisma.show.findUnique({
    where: { id: showId },
    include: { screen: true, movie: true },
  });

  if (!show) throw new AppError("Show not found", 404);

  // ✅ Ensure seats are locked by THIS user
  const key = lockKey(showId);

  for (const seat of seats) {
    const lockedBy = await redis.hget(key, seat);
    if (lockedBy !== userId) {
      throw new AppError(`Seat ${seat} is not locked by you`, 409);
    }
  }

  // ✅ Calculate amount from layout (cannot be changed from frontend)
  const { calcTotalFromLayout } = await import("../utils/calcTotal.js");
  const amount = calcTotalFromLayout(show.screen.layout, seats);

  if (amount <= 0) throw new AppError("Invalid amount", 400);

  // Stripe expects smallest unit (paise)
  const paymentIntent = await stripe.paymentIntents.create({
    amount: amount * 100,
    currency: "inr",
    metadata: {
      userId,
      showId,
      seats: JSON.stringify(seats),
      movieTitle: show.movie?.title || "",
    },
  });

  res.json({
    success: true,
    clientSecret: paymentIntent.client_secret,
    amount,
    ttlSeconds: LOCK_TTL_SECONDS,
  });
});
