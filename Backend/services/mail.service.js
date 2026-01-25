import nodemailer from "nodemailer";
console.log("SENDING FROM:", process.env.EMAIL_USER);
console.log("PASS LOADED:", process.env.EMAIL_PASS ? "✅ YES" : "❌ NO");


export const sendMail = async ({ to, subject, html, attachments = [] }) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  await transporter.sendMail({
    from: `"MovieShow" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
    attachments, // ✅ added
  });
};