import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import api from "../api/api";
import { useQueryClient } from "@tanstack/react-query";
import Loading from "../components/Loading";
// Stripe
import { CardElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { Clock3, ArrowLeft } from "lucide-react";

const Payment = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();

  const stripe = useStripe();
  const elements = useElements();

  const bookingId = location.state?.bookingId || null;

  const [showId, setShowId] = useState(null); // backend source of truth
  const [clientSecret, setClientSecret] = useState("");
  const [amount, setAmount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [seats, setSeats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [paymentFailed, setPaymentFailed] = useState(false);

  const confirmedRef = useRef(false);
  const expiredRef = useRef(false);

  // ✅ Invalid access guard (DO NOT use showId here)
  useEffect(() => {
    if (!bookingId) {
      toast.error("Invalid booking");
      navigate("/my-bookings", { replace: true });
    }
  }, [bookingId, navigate]);

  // ✅ Create PaymentIntent
  useEffect(() => {
    if (!bookingId) return;

    const createIntent = async () => {
      try {
        const { data } = await api.post("/payments/create-intent", {
          bookingId,
        });

        setShowId(data.showId);
        setClientSecret(data.clientSecret);
        setAmount(data.amount);
        setTimeLeft(data.ttlSeconds * 1000);
        setSeats(data.seats || []);
      } catch (err) {
        toast.error(err?.response?.data?.message || "Payment expired");
        navigate("/my-bookings", { replace: true });
      }
    };

    createIntent();
  }, [bookingId, navigate]);

  // ⏱ Countdown (state only, no side-effects)
  useEffect(() => {
    if (!timeLeft) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => prev - 1000);
    }, 1000);

    return () => clearInterval(interval);
  }, [timeLeft]);

  // ⏱ Handle expiry safely
  useEffect(() => {
    if (timeLeft > 0 || expiredRef.current || !showId) return;

    expiredRef.current = true;

    (async () => {
      toast.error("Payment time expired");
      await queryClient.invalidateQueries({ queryKey: ["myBookings"] });

      navigate(`/shows/${showId}/seats`, {
        replace: true,
        state: { expired: true },
      });
    })();
  }, [timeLeft, showId, navigate, queryClient]);

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

  // ❌ Cancel Payment (guard added)
  const handleCancelPayment = async () => {
    if (!showId) {
      navigate("/my-bookings", { replace: true });
      return;
    }

    toast("Payment cancelled");

    navigate(`/shows/${showId}/seats`, {
      replace: true,
      state: { expired: true },
    });

    try {
      await api.post("/payments/cancel", { bookingId });
    } finally {
      queryClient.invalidateQueries({ queryKey: ["myBookings"] });
    }
  };
    if (!clientSecret) {
  return (
    <Loading/>
  );
}
  return (
  
    <div className="min-h-screen bg-gray-100 flex justify-center px-4 py-10">
      <div className="w-full max-w-4xl grid lg:grid-cols-3 gap-6">
        {/* PAYMENT */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow p-6">
          <h1 className="text-xl font-semibold text-gray-900 mb-1">
            Secure Payment
          </h1>

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
            className="mt-6 w-full bg-red-600 text-white py-3 rounded-xl"
          >
            {loading ? "Processing…" : `Pay ₹${amount || "—"}`}
          </button>

          <div className="mt-4 flex justify-between text-sm">
            <button
              onClick={() => navigate("/my-bookings")}
              className="flex items-center gap-1 text-gray-600"
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

        {/* SUMMARY */}
        <div className="bg-white rounded-2xl shadow p-6 h-fit">
          <p className="font-medium">Seats</p>
          <p>{seats.length ? seats.join(", ") : "—"}</p>

          <div className="mt-4 flex justify-between">
            <span>Total</span>
            <span>₹{amount || "—"}</span>
          </div>

          <div className="mt-4 flex justify-between text-red-600">
            <span>Time left</span>
            <span>
              {String(minutes).padStart(2, "0")}:
              {String(seconds).padStart(2, "0")}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Payment;