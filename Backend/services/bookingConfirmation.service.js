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

  // 🔒 Safety checks
  if (!booking) {
    console.error("❌ Booking not found:", bookingId);
    return;
  }

  if (booking.isPaid) {
    console.warn("⚠️ Booking already confirmed:", bookingId);
    return;
  }

  // ✅ CONFIRM BOOKING (atomic)
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

  // 🚀 BACKGROUND TASKS (email + cleanup)
  setImmediate(async () => {
    try {
      // 🔐 Avoid duplicate emails
      if (updatedBooking.emailSent) {
        console.warn("📧 Email already sent for booking:", bookingId);
        return;
      }

      // 1️⃣ Generate QR
      const qrBuffer = await generateBookingQRBuffer(updatedBooking.id);

      // 🔥 SendGrid requires BASE64 string
      const qrBase64 = qrBuffer.toString("base64");

      // 2️⃣ Send email
      await sendMail({
        to: updatedBooking.user.email,
        subject: "🎟 Booking Confirmed",
        html: bookingConfirmTemplate(updatedBooking),
        attachments: [
          {
            content: qrBase64,                 // ✅ base64 string
            filename: `ticket-${updatedBooking.id}.png`,
            type: "image/png",
            disposition: "inline",
            contentId: "booking_qr",            // ✅ must match HTML
          },
        ],
      });

      // 3️⃣ Mark email as sent
      await prisma.booking.update({
        where: { id: updatedBooking.id },
        data: { emailSent: true },
      });

      // 4️⃣ Release seat locks
      const lockKey = `lock:show:${updatedBooking.showId}`;
      if (updatedBooking.bookedSeats?.length) {
        await redis.hdel(lockKey, ...updatedBooking.bookedSeats);
      }

      console.log("✅ Booking confirmed + email sent:", bookingId);
    } catch (err) {
      console.error("❌ Post-confirmation task failed:", err);
    }
  });
};