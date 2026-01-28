import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "react-hot-toast";
import api from "../api/api";
import { useQueryClient } from "@tanstack/react-query";
// Stripe
import { CardElement, useElements, useStripe } from "@stripe/react-stripe-js";

import { Clock3, ArrowLeft } from "lucide-react";

const Payment = () => {
    const queryClient = useQueryClient();
  const { showId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const stripe = useStripe();
  const elements = useElements();

  const bookingId = location.state?.bookingId || null;

  const [clientSecret, setClientSecret] = useState("");
  const [amount, setAmount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [seats, setSeats] = useState([]); // ✅ REQUIRED
  const [loading, setLoading] = useState(false);
  const [paymentFailed, setPaymentFailed] = useState(false);

  const confirmedRef = useRef(false);

  // ❌ Invalid access guard
  useEffect(() => {
    if (!bookingId) {
      toast.error("Invalid booking");
      navigate(`/shows/${showId}/seats`, { replace: true });
    }
  }, [bookingId, showId, navigate]);

  // ✅ Create PaymentIntent
  useEffect(() => {
    const createIntent = async () => {
      try {
        const { data } = await api.post("/payments/create-intent", {
          bookingId,
        });

        setClientSecret(data.clientSecret);
        setAmount(data.amount);
        setTimeLeft(data.ttlSeconds * 1000);
        setSeats(data.seats || []); // ✅ FIX
      } catch (err) {
        toast.error(err?.response?.data?.message || "Payment expired");
           navigate(`/shows/${showId}/seats`, {
  replace: true,
  state: { expired: true }, // 👈 important
});
      }
    };

    if (bookingId) createIntent();
  }, [bookingId, navigate, showId]);

  // ⏱ Countdown
  useEffect(() => {
    if (!timeLeft) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1000) {
          clearInterval(interval);
          toast.error("Payment time expired");
          return 0;
        }
        return prev - 1000;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timeLeft, navigate, showId]);

  const minutes = Math.floor(timeLeft / 60000);
  const seconds = Math.floor((timeLeft % 60000) / 1000);

  // 💳 Pay Now
  const handlePayNow = async () => {
    if (!stripe || !elements || !clientSecret || timeLeft <= 0) {
      toast.error("Payment is not ready yet");
      return;
    }

    try {
      setLoading(true);
      const card = elements.getElement(CardElement);

      const result = await stripe.confirmCardPayment(clientSecret, {
        payment_method: { card },
      });

      if (result.error) {
        setPaymentFailed(true);
        toast.error(result.error.message);
        return;
      }

      if (result.paymentIntent?.status === "succeeded") {
        if (confirmedRef.current) return;
        confirmedRef.current = true;
       await queryClient.invalidateQueries({ queryKey: ["myBookings"] });
navigate(`/payment/success/${bookingId}`, { replace: true });
      }
    } finally {
      setLoading(false);
    }
  };

  // ❌ Cancel Payment
  const handleCancelPayment = async () => {
    try {
      await api.post("/payments/cancel", { bookingId });
    } catch (err) {
      console.error(err);
    } finally {
      toast("Payment cancelled");
     await queryClient.invalidateQueries({ queryKey: ["myBookings"] });
      navigate(`/shows/${showId}/seats`, {
  replace: true,
  state: { expired: true }, // 👈 important
});
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex justify-center px-4 py-10">
      <div className="w-full max-w-4xl grid lg:grid-cols-3 gap-6">

        {/* PAYMENT */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow p-6">
          <h1 className="text-xl font-semibold text-gray-900 mb-1">
            Secure Payment
          </h1>
          <p className="text-sm text-gray-500 mb-6">
            Enter your card details to complete booking
          </p>

          <div className="border rounded-xl p-4 bg-gray-50">
            <CardElement />
          </div>

          {paymentFailed && (
            <p className="text-sm text-red-600 mt-3">
              Payment failed. Please try again.
            </p>
          )}

          <button
            disabled={loading || !clientSecret || timeLeft <= 0}
            onClick={handlePayNow}
            className="mt-6 w-full bg-red-600 hover:bg-red-700 
                       text-white py-3 rounded-xl font-semibold
                       disabled:opacity-50 transition"
          >
            {loading ? "Processing…" : `Pay ₹${amount}`}
          </button>

          <div className="mt-4 flex justify-between text-sm">
            <button
              onClick={() => navigate("/my-bookings")}
              className="flex items-center gap-1 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>

            <button
              onClick={handleCancelPayment}
              className="text-red-600 hover:underline"
            >
              Cancel Payment
            </button>
          </div>
        </div>

        {/* ORDER SUMMARY */}
        <div className="bg-white rounded-2xl shadow p-6 h-fit">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Order Summary
          </h2>

          <div className="space-y-3 text-sm text-gray-700">
            <div>
              <p className="font-medium text-gray-900">Seats</p>
              <p className="mt-1">
                {seats.length ? seats.join(", ") : "—"}
              </p>
            </div>

            <div className="flex justify-between items-center border-t pt-3">
              <span className="font-medium text-gray-900">Total</span>
              <span className="text-xl font-bold">₹{amount}</span>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between 
                          bg-red-50 border border-red-200 
                          text-red-700 px-4 py-3 rounded-xl">
            <div className="flex items-center gap-2">
              <Clock3 className="w-4 h-4" />
              <span className="text-sm font-medium">Time left</span>
            </div>

            <span className="font-semibold tracking-wide">
              {String(minutes).padStart(2, "0")}:
              {String(seconds).padStart(2, "0")}
            </span>
          </div>

          <p className="mt-4 text-xs text-gray-500">
            Seats are temporarily reserved. Complete payment before
            the timer expires to confirm booking.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Payment;