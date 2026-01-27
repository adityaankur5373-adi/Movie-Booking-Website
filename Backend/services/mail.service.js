import sgMail from "@sendgrid/mail";

const rawKey = process.env.SENDGRID_API_KEY || "";
const cleanKey = rawKey.replace(/\s+/g, ""); // removes \n, spaces, etc.

sgMail.setApiKey(cleanKey);

export const sendMail = async ({ to, subject, html, attachments }) => {
  console.log("📧 Sending email to:", to);

  await sgMail.send({
    to,
    from: "Movie Tickets <adityaankur5373@gmail.com>",
    replyTo: "adityaankur5373@gmail.com",
    subject,
    html,
    attachments,
  });

  console.log("✅ Email sent via SendGrid");
};