import Stripe from "stripe";
import { confirmBookingFromWebhook } from "../services/bookingConfirmation.service.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const stripeWebhook = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "payment_intent.succeeded") {
    const pi = event.data.object;

    await confirmBookingFromWebhook({
      bookingId: pi.metadata.bookingId,
      paymentIntentId: pi.id,
    });
  }

  res.status(200).send("ok");
};