import sgMail from "@sendgrid/mail";

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

export const sendMail = async ({ to, subject, html, attachments }) => {
  console.log("📧 Sending email to:", to);

  await sgMail.send({
    to,
    from: "Movie Tickets <adityaankur5373@gmail.com>", // VERIFIED
    replyTo: "adityaankur5373@gmail.com",
    subject,
    html,
    attachments, // QR CID still works
  });

  console.log("✅ Email sent via SendGrid");
};