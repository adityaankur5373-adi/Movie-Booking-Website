import { prisma } from "../config/prisma.js";
import redis from "../config/redis.js";
import { generateBookingQRBuffer } from "../utils/generateQr.js";
import { sendMail } from "./mail.service.js";
import { bookingConfirmTemplate } from "../templates/bookingConfirm.js";

export const confirmBookingFromWebhook = async ({ bookingId, paymentIntentId }) => {
  const booking = await prisma.booking.findUnique({
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

  // 🛡 Idempotency protection
  if (!booking || booking.isPaid) return;

  // 1️⃣ CONFIRM BOOKING
  const updatedBooking = await prisma.booking.update({
    where: { id: bookingId },
    data: {
      isPaid: true,
      status: "CONFIRMED",
      paymentIntentId,
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

  // 2️⃣ BACKGROUND TASKS (non-blocking)
  setImmediate(async () => {
    try {
      const qr = await generateBookingQRBuffer(updatedBooking.id);

      await sendMail({
        to: updatedBooking.user.email,
        subject: "🎟 Booking Confirmed",
        html: bookingConfirmTemplate(updatedBooking),
        attachments: [
          { filename: `ticket-${updatedBooking.id}.png`, content: qr },
        ],
      });

      // release seat locks
      const lockKey = `lock:show:${updatedBooking.showId}`;
      await redis.hdel(lockKey, ...updatedBooking.bookedSeats);
    } catch (err) {
      console.error("Post-confirmation task failed:", err);
    }
  });
};