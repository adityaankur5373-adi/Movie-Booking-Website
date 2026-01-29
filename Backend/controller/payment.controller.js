import Stripe from "stripe";
import asyncHandler from "../middlewares/asyncHandler.js";
import AppError from "../utils/AppError.js";
import redis from "../config/redis.js";
import { prisma } from "../config/prisma.js";
import { calcTotalFromLayout } from "../utils/calcTotal.js";
import { LOCK_TTL_SECONDS } from "../config/seatLock.config.js";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const createPaymentIntent = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { bookingId } = req.body;

  if (!bookingId) throw new AppError("bookingId is required", 400);

  // 1️⃣ Fetch booking
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      show: {
        include: { screen: true },
      },
    },
  });

  if (!booking) throw new AppError("Booking not found", 404);
  if (booking.userId !== userId) throw new AppError("Not allowed", 403);

  // ✅ already paid → short circuit
  if (booking.isPaid) {
    return res.json({
      success: true,
      clientSecret: null,
      amount: booking.totalAmount,
    });
  }

  if (!booking.show?.screen?.layout) {
    throw new AppError("Seat layout missing", 500);
  }

  const seats = booking.bookedSeats;
  const redisKey = lockKey(booking.showId);

  // 2️⃣ CHECK TTL FIRST (do NOT revive dead locks)
  const ttl = await redis.ttl(redisKey);

  if (ttl <= 0) {
    throw new AppError(
      "Seat lock expired. Please select seats again.",
      410
    );
  }

  // 3️⃣ EXTEND TTL ONCE (payment grace period)
  await redis.expire(redisKey, LOCK_TTL_SECONDS);

  // 4️⃣ FINAL seat ownership validation (AUTHORITATIVE)
  for (const seat of seats) {
    const lockedBy = await redis.hget(redisKey, seat);

    if (!lockedBy) {
      throw new AppError(
        "Seat lock expired. Please select seats again.",
        410
      );
    }

    if (String(lockedBy) !== String(userId)) {
      throw new AppError(
        "Seat is no longer available.",
        409
      );
    }
  }

  // 5️⃣ Calculate amount server-side (authoritative)
  const amount = calcTotalFromLayout(
    booking.show.screen.layout,
    seats,
    booking.show.seatPrice
  );

  if (amount <= 0) {
    throw new AppError("Invalid amount", 400);
  }

  // 6️⃣ Persist amount if changed
  if (!booking.isPaid && booking.totalAmount !== amount) {
    await prisma.booking.update({
      where: { id: bookingId },
      data: { totalAmount: amount },
    });
  }

  let paymentIntent = null;

  // ================================
  // ♻️ Reuse existing PaymentIntent
  // ================================
  if (booking.paymentIntentId) {
    paymentIntent = await stripe.paymentIntents.retrieve(
      booking.paymentIntentId
    );

    // safety check
    if (paymentIntent.metadata.bookingId !== bookingId) {
      throw new AppError("PaymentIntent mismatch", 400);
    }

    // already succeeded
    if (paymentIntent.status === "succeeded") {
      return res.json({
        success: true,
        clientSecret: null,
        amount: booking.totalAmount,
      });
    }

    // canceled → drop & recreate
    if (paymentIntent.status === "canceled") {
      await prisma.booking.update({
        where: { id: bookingId },
        data: { paymentIntentId: null },
      });
      paymentIntent = null;
    }

    // update amount if required
    if (
      paymentIntent &&
      paymentIntent.status === "requires_payment_method" &&
      paymentIntent.amount !== amount * 100
    ) {
      paymentIntent = await stripe.paymentIntents.update(
        booking.paymentIntentId,
        { amount: amount * 100 }
      );
    }
  }

  // ================================
  // 🆕 Create new PaymentIntent
  // ================================
  if (!paymentIntent) {
    paymentIntent = await stripe.paymentIntents.create(
      {
        amount: amount * 100,
        currency: "inr",
        metadata: {
          bookingId,
          userId,
          showId: booking.showId,
        },
      },
      {
        // Stripe idempotency
        idempotencyKey: `booking_${bookingId}`,
      }
    );

    // DB idempotency
    await prisma.booking.update({
      where: { id: bookingId },
      data: { paymentIntentId: paymentIntent.id },
    });
  }

  // 7️⃣ Final response
  return res.json({
    success: true,
    clientSecret: paymentIntent.client_secret,
    amount,
    seats,
    ttlSeconds: await redis.ttl(redisKey),
    showId: booking.show.id,
  });
});
export const cancelPayment = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { bookingId } = req.body;

  if (!bookingId) throw new AppError("bookingId is required", 400);

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
  });

  if (!booking) throw new AppError("Booking not found", 404);
  if (booking.userId !== userId) throw new AppError("Not allowed", 403);

  // already paid → cannot cancel
  if (booking.isPaid) {
    throw new AppError("Booking already paid", 400);
  }

  // 1️⃣ Mark booking as CANCELLED (ONLY ONCE)
  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      status: "CANCELLED",
      expiredAt: new Date(),
    },
  });

  // 2️⃣ Release seat locks (Redis)
const key = lockKey(booking.showId);

  if (booking.bookedSeats?.length) {
    const pipeline = redis.pipeline();
    booking.bookedSeats.forEach((seat) =>
      pipeline.hget(key, seat)
    );

    const results = await pipeline.exec();

    const toDelete = [];
    results.forEach((r, i) => {
      const lockedBy = r?.[1];
      if (lockedBy === userId) {
        toDelete.push(booking.bookedSeats[i]); // ✅ FIXED
      }
    });

    if (toDelete.length > 0) {
      await redis.hdel(key, ...toDelete);
    }
  }



  return res.json({
    success: true,
    message: "Payment cancelled and seats released",
  });
});