import QRCode from "qrcode";

export const generateQrBase64 = async (text) => {
  // returns: data:image/png;base64,xxxx
  return await QRCode.toDataURL(text, {
    errorCorrectionLevel: "H",
    width: 250,
  });
};