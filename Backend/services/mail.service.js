import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
console.log("RESEND_API_KEY:", process.env.RESEND_API_KEY?.slice(0, 6));
export const sendMail = async ({ to, subject, html }) => {
  console.log("📧 Sending email to:", to);
  await resend.emails.send({
    from: "Movie Tickets <onboarding@resend.dev>", // works without domain setup
    to,
    subject,
    html,
  });
};