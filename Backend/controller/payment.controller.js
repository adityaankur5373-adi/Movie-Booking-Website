import Stripe from "stripe";
import asyncHandler from "../middlewares/asyncHandler.js";
import AppError from "../utils/AppError.js";
import redis from "../config/redis.js";
import { prisma } from "../config/prisma.js";
import { calcTotalFromLayout } from "../utils/calcTotal.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);


const lockKey = (showId) => `lock:show:${showId}`;

export const createPaymentIntent = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { bookingId } = req.body;

  if (!bookingId) throw new AppError("bookingId is required", 400);

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

  // ✅ Already paid → short-circuit
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

  // 🔒 Enforce seat lock ownership
  // after checking seat locks
for (const seat of seats) {
  const lockedBy = await redis.hget(redisKey, seat);

  if (lockedBy !== userId) {
    // 🔥 Mark booking expired (ONCE)
    await prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: "EXPIRED",
        expiredAt: new Date(),
      },
    });

    // 🚫 Stop immediately
    throw new AppError("Booking expired", 410);
  }
}
 
  // 🔁 REFRESH LOCK TTL (important)
 
 const ttlSeconds = await redis.ttl(redisKey);
  // 💰 Calculate amount server-side
  const amount = calcTotalFromLayout(
    booking.show.screen.layout,
    seats,
    booking.show.seatPrice
  );

  if (amount <= 0) throw new AppError("Invalid amount", 400);

  // 💾 Persist amount safely
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

    // ✅ VERIFY intent belongs to booking
    if (paymentIntent.metadata.bookingId !== bookingId) {
      throw new AppError("PaymentIntent mismatch", 400);
    }

    // ✅ Already succeeded
    if (paymentIntent.status === "succeeded") {
      return res.json({
        success: true,
        clientSecret: null,
        amount: booking.totalAmount,
      });
    }

    // 🔁 If canceled → drop & recreate
    if (paymentIntent.status === "canceled") {
      await prisma.booking.update({
        where: { id: bookingId },
        data: { paymentIntentId: null },
      });
      paymentIntent = null;
    }

    // 🔄 Update amount if needed
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
        // ✅ Stripe idempotency
        idempotencyKey: `booking_${bookingId}`,
      }
    );

    // ✅ DB idempotency (paymentIntentId MUST be @unique)
    await prisma.booking.update({
      where: { id: bookingId },
      data: { paymentIntentId: paymentIntent.id },
    });
  }

  return res.json({
    success: true,
    clientSecret: paymentIntent.client_secret,
    amount,
    seats,
    ttlSeconds,
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

  // 1️⃣ Mark booking cancelled
  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      status: "CANCELLED",
      expiredAt: new Date(),
    },
  });

  // 2️⃣ Unlock seats using SAME logic
  const key = `lock:show:${booking.showId}`;

  if (booking.bookedSeats?.length) {
    const pipeline = redis.pipeline();
    booking.bookedSeats.forEach((seat) =>
      pipeline.hget(key, seat)
    );

    const results = await pipeline.exec();

    const toDelete = [];
    results.forEach((r, i) => {
      if (r?.[1] === userId) {
        toDelete.push(booking.bookedSeats[i]);
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