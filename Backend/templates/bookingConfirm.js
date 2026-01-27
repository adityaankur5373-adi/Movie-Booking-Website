export const bookingConfirmTemplate = (booking) => {
  const movieTitle = booking?.show?.movie?.title || "N/A";
  const theatreName = booking?.show?.screen?.theatre?.name || "N/A";
  const screenName = booking?.show?.screen?.name || "N/A";

  const seats = booking?.bookedSeats?.length
    ? booking.bookedSeats.join(", ")
    : "N/A";

  const showTime = booking?.show?.startTime
    ? new Date(booking.show.startTime).toLocaleString("en-IN")
    : "N/A";

  const total = booking?.totalAmount ?? "0";
  const bookingId = booking?.id || "N/A";

  const frontend = process.env.FRONTEND_URL || "https://your-frontend.com";
  const viewTicketUrl = `${frontend}/tickets/${bookingId}`;

  return `
  <div style="margin:0;padding:0;background:#f6f7fb;">
    <div style="max-width:600px;margin:0 auto;padding:20px;">
      
      <div style="background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 8px 20px rgba(0,0,0,0.08);">
        
        <div style="padding:18px 20px;background:linear-gradient(90deg,#111827,#1f2937);color:#fff;">
          <h2 style="margin:0;font-family:Arial,sans-serif;font-size:20px;">
            🎟 Booking Confirmed
          </h2>
          <p style="margin:6px 0 0;font-family:Arial,sans-serif;font-size:13px;opacity:0.85;">
            Your ticket is booked successfully.
          </p>
        </div>

        <div style="padding:20px;font-family:Arial,sans-serif;color:#111827;">
          
          <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:14px;">
            <p style="margin:0 0 10px;font-size:14px;"><b>Movie:</b> ${movieTitle}</p>
            <p style="margin:0 0 10px;font-size:14px;"><b>Theatre:</b> ${theatreName}</p>
            <p style="margin:0 0 10px;font-size:14px;"><b>Screen:</b> ${screenName}</p>
            <p style="margin:0 0 10px;font-size:14px;"><b>Seats:</b> ${seats}</p>
            <p style="margin:0 0 10px;font-size:14px;"><b>Show Time:</b> ${showTime}</p>
            <p style="margin:0;font-size:14px;"><b>Total Paid:</b> ₹${total}</p>
          </div>

          <div style="margin-top:16px;font-size:13px;color:#374151;">
            <p style="margin:0;"><b>Booking ID:</b> ${bookingId}</p>
            <p style="margin:6px 0 0;opacity:0.8;">
              Scan the QR code below at the theatre entrance.
            </p>
          </div>

          <!-- ✅ INLINE QR (CID) -->
          <div style="margin-top:18px;text-align:center;">
            <p style="margin:0 0 8px;font-size:13px;color:#374151;">
              🎫 Scan this QR at entry
            </p>

            <img
              src="cid:booking_qr"
              alt="Booking QR"
              style="display:block;margin:0 auto;width:160px;height:160px;
              border:1px solid #e5e7eb;border-radius:12px;padding:8px;background:#fff;"
            />

            <p style="margin:10px 0 0;font-size:12px;color:#6b7280;">
              If QR doesn’t load, click “View Ticket” below.
            </p>
          </div>

          <div style="margin-top:18px;text-align:center;">
            <a href="${viewTicketUrl}"
              style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;
              padding:12px 18px;border-radius:10px;font-weight:bold;font-size:14px;">
              View Ticket
            </a>
          </div>

          <div style="margin-top:18px;border-top:1px dashed #e5e7eb;padding-top:14px;">
            <p style="margin:0;font-size:12px;color:#6b7280;line-height:1.6;">
              Need help? Reply to this email.<br/>
              ⚠️ Please arrive 15 minutes early.
            </p>
          </div>

        </div>
      </div>

      <p style="text-align:center;margin:12px 0 0;font-family:Arial,sans-serif;font-size:11px;color:#9ca3af;">
        © ${new Date().getFullYear()} MovieShow. All rights reserved.
      </p>

    </div>
  </div>
  `;
};