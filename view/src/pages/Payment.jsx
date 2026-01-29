import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-hot-toast";
import api from "../api/api";
import Loading from "../components/Loading";

// Stripe
import { CardElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { ArrowLeft, Clock3 } from "lucide-react";

const Payment = () => {
  const { bookingId } = useParams();
  const navigate = useNavigate();

  const stripe = useStripe();
  const elements = useElements();

  // -------------------------
  // State
  // -------------------------
  const [showId, setShowId] = useState(null);
  const [seats, setSeats] = useState([]);
  const [amount, setAmount] = useState(0);
  const [clientSecret, setClientSecret] = useState("");
  const [timeLeft, setTimeLeft] = useState(0);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [paymentFailed, setPaymentFailed] = useState(false);

  const intentCreatedRef = useRef(false);
  const expiredRef = useRef(false);
  const confirmedRef = useRef(false);

  // -------------------------
  // Guard: invalid URL
  // -------------------------
  useEffect(() => {
    if (!bookingId) {
      toast.error("Invalid booking");
      navigate("/my-bookings", { replace: true });
    }
  }, [bookingId, navigate]);

  // -------------------------
  // Load booking summary
  // -------------------------
  useEffect(() => {
    if (!bookingId) return;

    const loadBooking = async () => {
      try {
        const { data } = await api.get(`/bookings/${bookingId}`);

        if (data.status !== "PENDING") {
          toast.error("Booking not available");
          navigate("/my-bookings", { replace: true });
          return;
        }

        setShowId(data.showId);
        setSeats(data.bookedSeats || []);
        setAmount(data.totalAmount || 0);

        // derive TTL from expiresAt
        const ttl =
          new Date(data.expiresAt).getTime() - Date.now();
        setTimeLeft(Math.max(ttl, 0));
      } catch {
        toast.error("Booking expired");
        navigate("/my-bookings", { replace: true });
      } finally {
        setPageLoading(false);
      }
    };

    loadBooking();
  }, [bookingId, navigate]);

  // -------------------------
  // Create / reuse PaymentIntent
  // -------------------------
  useEffect(() => {
    if (!bookingId || intentCreatedRef.current || pageLoading) return;

    intentCreatedRef.current = true;

    const createIntent = async () => {
      try {
        const { data } = await api.post(
          `/payments/${bookingId}/pay`
        );
        setClientSecret(data.clientSecret);
      } catch {
        toast.error("Payment session expired");
        navigate("/my-bookings", { replace: true });
      }
    };

    createIntent();
  }, [bookingId, pageLoading, navigate]);

  // -------------------------
  // Countdown timer
  // -------------------------
  useEffect(() => {
    if (timeLeft <= 0) return;

    const interval = setInterval(() => {
      setTimeLeft((t) => t - 1000);
    }, 1000);

    return () => clearInterval(interval);
  }, [timeLeft]);

  // -------------------------
  // Handle expiry
  // -------------------------
  useEffect(() => {
    if (timeLeft > 0 || expiredRef.current || !showId) return;

    expiredRef.current = true;
    toast.error("Payment time expired");

    navigate(`/shows/${showId}/seats`, {
      replace: true,
      state: { expired: true },
    });
  }, [timeLeft, showId, navigate]);

  // -------------------------
  // Pay now
  // -------------------------
  const handlePayNow = async () => {
    if (!stripe || !elements || !clientSecret || timeLeft <= 0) return;

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

      if (
        result.paymentIntent?.status === "succeeded" &&
        !confirmedRef.current
      ) {
        confirmedRef.current = true;
        navigate(`/payment/success/${bookingId}`, {
          replace: true,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  // -------------------------
  // Cancel payment
  // -------------------------
  
  const minutes = Math.floor(timeLeft / 60000);
  const seconds = Math.floor((timeLeft % 60000) / 1000);

  return (
    <div className="min-h-screen bg-gray-100 flex justify-center px-4 py-10">
      <div className="w-full max-w-5xl grid lg:grid-cols-3 gap-6">

        {/* LEFT: PAYMENT */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow p-6">
          <h1 className="text-xl font-semibold text-gray-900">
            Secure Payment
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Review your booking before paying
          </p>

          <div className="mt-6 border rounded-xl p-4 bg-gray-50">
            <CardElement />
          </div>

          {paymentFailed && (
            <p className="text-sm text-red-600 mt-3">
              Payment failed. Please try again.
            </p>
          )}

          <button
            onClick={handlePayNow}
            disabled={loading || timeLeft <= 0}
            className={`mt-6 w-full py-3 rounded-xl text-white font-medium
              ${
                timeLeft <= 0
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-red-600 hover:bg-red-700"
              }`}
          >
            {loading ? "Processing…" : `Pay ₹${amount}`}
          </button>

          <div className="mt-4 flex justify-between text-sm">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-1 text-gray-600"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>

          </div>
        </div>

        {/* RIGHT: SUMMARY */}
        <div className="bg-white rounded-2xl shadow p-6 h-fit">
          <p className="text-sm text-gray-500">Seats</p>
          <p className="text-gray-900 font-medium">
            {seats.join(", ")}
          </p>

          <div className="mt-4 flex justify-between text-sm">
            <span>Total</span>
            <span className="font-semibold">₹{amount}</span>
          </div>

          <div
            className={`mt-4 flex items-center justify-between text-sm
              ${
                timeLeft < 60000
                  ? "text-red-600 font-semibold"
                  : "text-gray-700"
              }`}
          >
            <span className="flex items-center gap-1">
              <Clock3 className="w-4 h-4" />
              Time left
            </span>
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