import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "react-hot-toast";
import api from "../api/api";

// Stripe
import { CardElement, useElements, useStripe } from "@stripe/react-stripe-js";

import { Clock3, ArrowLeft } from "lucide-react";

const Payment = () => {
  const { showId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const stripe = useStripe();
  const elements = useElements();

  const bookingId = location.state?.bookingId || null;
  const seats = location.state?.seats || [];

  const [clientSecret, setClientSecret] = useState("");
  const [amount, setAmount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [loading, setLoading] = useState(false);
  const [paymentFailed, setPaymentFailed] = useState(false);

  const confirmedRef = useRef(false);

  // ❌ Invalid access
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
      } catch (err) {
        toast.error(err?.response?.data?.message || "Payment expired");
        navigate(`/shows/${showId}/seats`, { replace: true });
      }
    };

    if (bookingId) createIntent();
  }, [bookingId, navigate, showId]);

  // ⏱ Countdown (UI only)
  useEffect(() => {
    if (!timeLeft) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1000) {
          clearInterval(interval);
          toast.error("Payment time expired");
          navigate(`/shows/${showId}/seats`, { replace: true });
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
    if (!stripe || !elements || timeLeft <= 0) return;

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
        navigate(`/payment/success/${bookingId}`, { replace: true });
      }
    } finally {
      setLoading(false);
    }
  };

  // ❌ CANCEL PAYMENT (HARD FLOW)
  const handleCancelPayment = async () => {
    try {
      await api.post("/payments/cancel", { bookingId });
    } catch (err) {
      console.error(err);
    } finally {
      toast("Payment cancelled");
      navigate(`/shows/${showId}/seats`, { replace: true });
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f5] pt-24 pb-20">
      <div className="max-w-6xl mx-auto px-4">
        <h1 className="text-2xl font-semibold text-gray-900 mb-6">
          Complete Payment
        </h1>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* LEFT */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border p-6">
            <p className="text-sm font-medium text-gray-600 mb-3">
              Card Details
            </p>

            <div className="border rounded-xl p-4">
              <CardElement />
            </div>

            {paymentFailed && (
              <p className="text-red-500 text-sm mt-3">
                Payment failed. Please try again.
              </p>
            )}

            <div className="mt-6 flex items-center gap-6">
              <button
                disabled={loading || !clientSecret || timeLeft <= 0}
                onClick={handlePayNow}
                className="bg-red-600 hover:bg-red-700 transition 
                           text-white px-6 py-3 rounded-xl font-medium 
                           disabled:opacity-50"
              >
                {loading ? "Processing..." : `Pay ₹${amount}`}
              </button>

              {/* ✅ BACK FLOW (NO SIDE EFFECTS) */}
              <button
                onClick={() => navigate("/my-bookings")}
                className="flex items-center gap-1 text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>

              {/* ❌ CANCEL FLOW (FINAL) */}
              <button
                onClick={handleCancelPayment}
                className="text-sm text-red-600 hover:underline"
              >
                Cancel Payment
              </button>
            </div>
          </div>

          {/* RIGHT */}
   {/* RIGHT */}
<div className="bg-white rounded-2xl shadow-md border border-gray-200 p-6">
  <h2 className="text-lg font-semibold text-gray-900 mb-4">
    Order Summary
  </h2>

  <div className="space-y-2">
    <p className="text-sm text-gray-700">
      <span className="font-medium text-gray-900">Seats:</span>{" "}
      {data.seats.join(", ")}
    </p>

    <p className="text-2xl font-bold text-gray-900">
      ₹{amount}
    </p>
  </div>

  {/* TIMER */}
  <div
    className="mt-6 flex items-center justify-between 
               bg-red-100 border border-red-200 
               text-red-700 px-4 py-3 rounded-xl"
  >
    <div className="flex items-center gap-2">
      <Clock3 className="w-4 h-4" />
      <span className="text-sm font-medium">
        Time remaining
      </span>
    </div>

    <span className="font-semibold tracking-wide">
      {String(minutes).padStart(2, "0")}:
      {String(seconds).padStart(2, "0")}
    </span>
  </div>

  <p className="mt-4 text-xs text-gray-600 leading-relaxed">
    Seats are reserved temporarily. Please complete the payment
    before the timer expires to confirm your booking.
  </p>
</div>
        </div>
      </div>
    </div>
  );
};

export default Payment;