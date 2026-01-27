import { prisma } from "../config/prisma.js";
import redis from "../config/redis.js";
import { generateBookingQRBuffer } from "../utils/generateQr.js";
import { sendMail } from "./mail.service.js";
import { bookingConfirmTemplate } from "../templates/bookingConfirm.js";

export const confirmBookingFromWebhook = async ({
  bookingId,
  paymentIntentId,
}) => {
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

  // 🔒 Idempotency protection with logs
  if (!booking) {
    console.error("❌ Booking not found:", bookingId);
    return;
  }

  if (booking.isPaid) {
    console.warn("⚠️ Booking already paid:", bookingId);
    return;
  }

  // ✅ CONFIRM BOOKING
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

  // 🚀 BACKGROUND TASKS
  setImmediate(async () => {
    try {
      const qr = await generateBookingQRBuffer(updatedBooking.id);

      await sendMail({
        to: updatedBooking.user.email,
        subject: "🎟 Booking Confirmed",
        html: bookingConfirmTemplate(updatedBooking),
        attachments: [
          {
            filename: `ticket-${updatedBooking.id}.png`,
            content: qr,
            cid: "booking_qr",
          },
        ],
      });

      // 🔓 Release seat locks SAFELY
      const lockKey = `lock:show:${updatedBooking.showId}`;

      if (updatedBooking.bookedSeats?.length) {
        await redis.hdel(lockKey, ...updatedBooking.bookedSeats);
      }

      console.log("✅ Seats released for booking:", bookingId);
    } catch (err) {
      console.error("❌ Post-confirmation task failed:", err);
    }
  });
};