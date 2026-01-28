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
  const [timeLeft, setTimeLeft] = useState(0); // ⏱ backend-driven
  const [loading, setLoading] = useState(false);
  const [paymentFailed, setPaymentFailed] = useState(false);

  const confirmedRef = useRef(false);

  // ❌ Invalid direct access
  useEffect(() => {
    if (!bookingId) {
      toast.error("Invalid booking");
      navigate(`/shows/${showId}/seats`, { replace: true });
    }
  }, [bookingId, showId, navigate]);

  // ✅ Create PaymentIntent (backend = source of truth)
  useEffect(() => {
    const createIntent = async () => {
      try {
        const { data } = await api.post("/payments/create-intent", {
          bookingId,
        });

        setClientSecret(data.clientSecret);
        setAmount(data.amount);
        setTimeLeft(data.ttlSeconds * 1000); // 🔥 backend TTL
      } catch (err) {
        toast.error(err?.response?.data?.message || "Payment expired");
        navigate(`/shows/${showId}/seats`, { replace: true });
      }
    };

    if (bookingId) createIntent();
  }, [bookingId, navigate, showId]);

  // ⏱ UI countdown (visual only)
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

  return (
    <div className="min-h-[85vh] px-6 md:px-16 lg:px-40 pt-28 pb-24">
      <h1 className="text-2xl font-semibold mb-6">Complete Payment</h1>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* LEFT */}
        <div className="lg:col-span-2 border rounded-xl p-6">
          <CardElement />

          {paymentFailed && (
            <p className="text-red-500 text-sm mt-3">
              Payment failed. Try again.
            </p>
          )}

          <div className="mt-6 flex gap-3">
            <button
              disabled={loading || !clientSecret || timeLeft <= 0}
              onClick={handlePayNow}
              className="bg-primary px-6 py-3 rounded-xl text-white"
            >
              {loading ? "Processing..." : "Pay Now"}
            </button>

            <button
              onClick={() => navigate("/my-bookings")}
              className="border px-6 py-3 rounded-xl"
            >
              <ArrowLeft className="inline w-4 h-4" /> Back
            </button>
          </div>
        </div>

        {/* RIGHT */}
        <div className="border rounded-xl p-6">
          <p className="font-semibold mb-2">Order Summary</p>
          <p>Seats: {seats.join(", ")}</p>
          <p className="mt-2 font-bold">₹{amount}</p>

          <div className="mt-4 flex items-center gap-2">
            <Clock3 className="w-4 h-4" />
            {String(minutes).padStart(2, "0")}:
            {String(seconds).padStart(2, "0")}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Payment;