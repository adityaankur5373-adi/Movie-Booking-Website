import Stripe from "stripe";
import { confirmBookingFromWebhook } from "../services/bookingConfirmation.service.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const stripeWebhook = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body, // RAW buffer
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("❌ Stripe signature error:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
   if (event.type === "payment_intent.succeeded") {
  const pi = event.data.object;

  await confirmBookingFromWebhook({
    bookingId: pi.metadata.bookingId,
    paymentIntentId: pi.id,
    amountReceived: pi.amount_received,
  });
}

    return res.status(200).send("ok");
  } catch (err) {
    console.error("❌ Webhook processing failed:", err);
    return res.status(500).send("Webhook handler failed");
  }
};

export default stripeWebhook;