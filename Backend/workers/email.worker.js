import { Worker } from "bullmq";
import bullRedis from "../config/bullRedis.js";
import { sendMail } from "../services/mail.service.js";
import { generateQrBase64 } from "../utils/generateQr.js";

export const emailWorker = new Worker(
  "emailQueue",
  async (job) => {
    const { type, to, subject, html, bookingId } = job.data;

    console.log("📩 Processing email job:", type, to);

    // ✅ If bookingId exists → generate QR
    if (bookingId) {
      const qrText = `BOOKING_ID:${bookingId}`;
      const qrBase64 = await generateQrBase64(qrText);

      // Convert base64 to buffer for attachment
      const qrBuffer = Buffer.from(qrBase64.split(",")[1], "base64");

      await sendMail({
        to,
        subject,
        html: `
          ${html}
          <br/><br/>
          <h3>Your QR Ticket</h3>
          <p>Show this QR code at the theatre entry.</p>
          <img src="cid:ticketqr" alt="QR Code" />
        `,
        attachments: [
          {
            filename: `ticket-${bookingId}.png`,
            content: qrBuffer,
            cid: "ticketqr", // must match img src
          },
        ],
      });

      return;
    }

    // ✅ Normal email if no bookingId
    await sendMail({ to, subject, html });
  },
  { connection: bullRedis }
);

emailWorker.on("completed", (job) => {
  console.log("✅ Email job completed:", job.id);
});

emailWorker.on("failed", (job, err) => {
  console.log("❌ Email job failed:", job?.id, err.message);
});