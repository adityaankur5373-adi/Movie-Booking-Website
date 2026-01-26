import QRCode from "qrcode";

export const generateBookingQRBuffer = async (bookingId) => {
  const frontend = process.env.FRONTEND_URL || "http://localhost:5173";

  const ticketUrl = `${frontend}/tickets/${bookingId}`;

  const qrBuffer = await QRCode.toBuffer(ticketUrl, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 220,
  });

  return qrBuffer;
};