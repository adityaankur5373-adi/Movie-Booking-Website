import Stripe from "stripe";
import asyncHandler from "../middlewares/asyncHandler.js";
import AppError from "../utils/AppError.js";
import redis from "../config/redis.js";
import { prisma } from "../config/prisma.js";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const createPayment = async (req, res) => {
  const { bookingId } = req.params;

  // 🔒 TRANSACTION = safe for retries
  const result = await prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      include: {
        show: {
          include: { screen: true },
        },
        seatLocks: true, // if you have relation
      },
    });

    if (!booking || booking.status !== "PENDING") {
      throw new Error("Invalid booking");
    }

    // 🔒 ensure seat locks still valid
    const lockedSeatsCount = await tx.seatLock.count({
      where: {
        bookingId,
        status: "LOCKED",
      },
    });

    if (lockedSeatsCount !== booking.bookedSeats.length) {
      throw new Error("Seat lock expired");
    }

    // 💰 CALCULATE PRICE IF NOT DONE
    let totalAmount = booking.totalAmount;

    if (totalAmount <= 0) {
      const layout = booking.show.screen.layout;
      const seats = booking.bookedSeats;

      totalAmount = calcTotalFromLayout(
        layout,
        seats,
        booking.show.seatPrice
      );

      await tx.booking.update({
        where: { id: bookingId },
        data: { totalAmount },
      });
    }

    // 🔁 REUSE PAYMENT INTENT
    if (booking.paymentIntentId) {
      const existingIntent =
        await stripe.paymentIntents.retrieve(
          booking.paymentIntentId
        );

      return {
        clientSecret: existingIntent.client_secret,
        amount: totalAmount,
        seats: booking.bookedSeats,
      };
    }

    // 💳 CREATE STRIPE PAYMENT INTENT (ONCE)
    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: totalAmount * 100,
        currency: "inr",
        metadata: { bookingId },
      },
      {
        idempotencyKey: bookingId,
      }
    );

    await tx.booking.update({
      where: { id: bookingId },
      data: { paymentIntentId: paymentIntent.id },
    });

    return {
      clientSecret: paymentIntent.client_secret,
      amount: totalAmount,
      seats: booking.bookedSeats,
    };
  });

  res.json(result);
};
