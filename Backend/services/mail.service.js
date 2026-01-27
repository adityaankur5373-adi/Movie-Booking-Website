import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendMail = async ({ to, subject, html }) => {
  await resend.emails.send({
    from: "Movie Tickets <onboarding@resend.dev>", // works without domain setup
    to,
    subject,
    html,
  });
};