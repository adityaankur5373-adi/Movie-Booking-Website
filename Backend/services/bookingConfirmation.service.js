import { prisma } from "../config/prisma.js";
import redis from "../config/redis.js";
import { generateBookingQRBuffer } from "../utils/generateQr.js";
import { sendMail } from "./mail.service.js";
import { bookingConfirmTemplate } from "../templates/bookingConfirm.js";

export const confirmBookingFromWebhook = async ({
  bookingId,
  paymentIntentId,
  amountReceived, // pass pi.amount_received
}) => {
  let confirmedBooking = null;

  // 🔒 ATOMIC DB TRANSACTION
  await prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      include: {
        user: true,
        show: {
          include: {
            movie: true,
            screen: { include: { theatre: true } },
          },
        },
      },
    });

    // ❌ invalid booking
    if (!booking) {
      console.error("❌ Booking not found:", bookingId);
      return;
    }

    // 🔁 idempotency (already confirmed)
    if (booking.isPaid) {
      console.warn("⚠️ Booking already confirmed:", bookingId);
      return;
    }

    // 🔐 amount verification (VERY IMPORTANT)
    if (amountReceived !== booking.totalAmount * 100) {
      throw new Error(
        `Amount mismatch for booking ${bookingId}: expected ${
          booking.totalAmount * 100
        }, got ${amountReceived}`
      );
    }

    // ✅ CONFIRM BOOKING
    confirmedBooking = await tx.booking.update({
      where: { id: bookingId },
      data: {
        isPaid: true,
        status: "CONFIRMED",
        paymentIntentId, // MUST be @unique
      },
      include: {
        user: true,
        show: {
          include: {
            movie: true,
            screen: { include: { theatre: true } },
          },
        },
      },
    });
  });

  // ❌ nothing changed → stop here
  if (!confirmedBooking) return;
      const version = await getBookingsCacheVersion();
await redis.del(
myBookingsKey(version, confirmedBooking.userId)
);
  // 🚀 BACKGROUND TASKS (NON-BLOCKING)
  setImmediate(async () => {
    try {
      // 🔁 avoid duplicate email
      if (confirmedBooking.emailSent) {
        console.warn("📧 Email already sent:", bookingId);
        return;
      }

      // 1️⃣ Generate QR
      const qrBuffer = await generateBookingQRBuffer(confirmedBooking.id);
      const qrBase64 = qrBuffer.toString("base64");

      // 2️⃣ Send email
      await sendMail({
        to: confirmedBooking.user.email,
        subject: "🎟 Booking Confirmed",
        html: bookingConfirmTemplate(confirmedBooking),
        attachments: [
          {
            content: qrBase64,
            filename: `ticket-${confirmedBooking.id}.png`,
            type: "image/png",
            disposition: "inline",
            content_id: "booking_qr",
          },
        ],
      });

      // 3️⃣ Mark email sent
      await prisma.booking.update({
        where: { id: confirmedBooking.id },
        data: { emailSent: true },
      });

      // 4️⃣ Optional: release seat locks early
      const lockKey = `lock:show:${confirmedBooking.showId}`;
      if (confirmedBooking.bookedSeats?.length) {
        await redis.hdel(lockKey, ...confirmedBooking.bookedSeats);
      }

      console.log("✅ Booking confirmed + email sent:", bookingId);
    } catch (err) {
      console.error("❌ Post-confirmation task failed:", err);
    }
  });
};