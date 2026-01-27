import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "react-hot-toast";
import api from "../api/api";

// Stripe
import { CardElement, useElements, useStripe } from "@stripe/react-stripe-js";

import {
  ShieldCheck,
  Clock3,
  Ticket,
  CreditCard,
  IndianRupee,
  XCircle,
  ArrowLeft,
} from "lucide-react";

const TTL_MS = 5 * 60 * 1000; // 5 minutes

const Payment = () => {
  const { showId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const stripe = useStripe();
  const elements = useElements();

  // ✅ Make state stable (avoid infinite rerender loop)
  const stateSeats = useMemo(() => location.state?.seats || [], [location.state]);
  const stateBookingId = useMemo(
    () => location.state?.bookingId || null,
    [location.state]
  );

  const fromBookingPage = location.state?.fromBookingPage || false;

  const [seats, setSeats] = useState(stateSeats);
  const [bookingId, setBookingId] = useState(stateBookingId);

  const [loading, setLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(TTL_MS);
  const [paymentFailed, setPaymentFailed] = useState(false);

  const [clientSecret, setClientSecret] = useState("");
  const [amount, setAmount] = useState(0);

  const confirmedRef = useRef(false);

  // ✅ Unlock Seats
  const unlockSeats = async () => {
    try {
      if (!showId || !bookingId) return;

      const saved = localStorage.getItem(`payment_${bookingId}`);
      const parsed = saved ? JSON.parse(saved) : null;

      const seatsToUnlock = parsed?.seats || seats || [];

      if (seatsToUnlock.length > 0) {
        await api.post(`/shows/${showId}/unlock`, { seats: seatsToUnlock });
      }

      localStorage.removeItem(`payment_${bookingId}`);
    } catch (err) {
      console.log("Unlock error:", err?.response?.data || err.message);
    }
  };

  // ✅ Setup seats + restore on refresh (FIXED)
  useEffect(() => {
    if (!showId) return;

    // If bookingId not in state and also not in storage, redirect
    if (!stateBookingId) {
      toast.error("Invalid booking. Please select seats again.");
      navigate(`/shows/${showId}/seats`, { replace: true });
      return;
    }

    const key = `payment_${stateBookingId}`;

    const saved = localStorage.getItem(key);
    const parsed = saved ? JSON.parse(saved) : null;

    // ✅ Fresh entry from seats page OR booking page
    if (stateSeats.length > 0 && stateBookingId) {
      // ✅ DO NOT overwrite createdAt if already exists
      if (!parsed?.createdAt) {
        localStorage.setItem(
          key,
          JSON.stringify({
            seats: stateSeats,
            bookingId: stateBookingId,
            createdAt: Date.now(),
          })
        );
      }

      setSeats(stateSeats);
      setBookingId(stateBookingId);
      setPaymentFailed(false);
      return;
    }

    // ✅ Refresh restore
    if (parsed) {
      setSeats(parsed.seats || []);
      setBookingId(parsed.bookingId || null);

      // ensure createdAt exists
      if (!parsed.createdAt) {
        parsed.createdAt = Date.now();
        localStorage.setItem(key, JSON.stringify(parsed));
      }
    } else {
      toast.error("No seats selected. Please select again.");
      navigate(`/shows/${showId}/seats`, { replace: true });
    }
  }, [showId, stateSeats, stateBookingId, navigate]);

  // ✅ Create Stripe PaymentIntent
  useEffect(() => {
    const createIntent = async () => {
      try {
        if (!showId || seats.length === 0 || !bookingId) return;

        const { data } = await api.post("/payments/create-intent", {
          showId,
          seats,
          bookingId,
          skipLock: fromBookingPage,
        });

        if (data?.success) {
          setClientSecret(data.clientSecret);
          setAmount(data.amount);
        } else {
          toast.error("Failed to start payment");
        }
      } catch (err) {
        console.log("Create intent error:", err?.response?.data || err.message);
        toast.error(err?.response?.data?.message || "Failed to start payment");
      }
    };

    createIntent();
  }, [showId, seats, bookingId, fromBookingPage]);

  // ✅ Timer (continues from stored createdAt)
  useEffect(() => {
    if (!showId || !bookingId) return;

    let interval;

    const startTimer = async () => {
      try {
        const saved = localStorage.getItem(`payment_${bookingId}`);
        const parsed = saved ? JSON.parse(saved) : null;

        const createdAt = parsed?.createdAt;
        if (!createdAt) return;

        const updateTime = async () => {
          const left = TTL_MS - (Date.now() - createdAt);

          if (left <= 0) {
            setTimeLeft(0);
            clearInterval(interval);
            toast.error("Payment time expired. Seats released.");
            await unlockSeats();
            navigate(`/shows/${showId}/seats`, { replace: true });
            return;
          }

          setTimeLeft(left);
        };

        // immediate update
        await updateTime();

        interval = setInterval(updateTime, 1000);
      } catch (err) {
        console.log("Timer error:", err?.response?.data || err.message);
      }
    };

    startTimer();

    return () => {
      if (interval) clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showId, bookingId]);

  const totalSeats = useMemo(() => seats.length, [seats]);

  const minutes = Math.max(0, Math.floor(timeLeft / 60000));
  const seconds = Math.max(0, Math.floor((timeLeft % 60000) / 1000));

  const dangerTimer = timeLeft <= 60 * 1000;
  const isExpired = timeLeft <= 0;

  // ✅ Pay Now
    // ONLY CHANGED PARTS ARE MARKED WITH 🔥

const handlePayNow = async () => {
  if (isExpired) {
    toast.error("Time expired. Please select seats again.");
    await unlockSeats();
    return navigate(`/shows/${showId}/seats`, { replace: true });
  }

  if (!stripe || !elements) return toast.error("Stripe not ready");
  if (!clientSecret) return toast.error("Client secret not ready");

  const card = elements.getElement(CardElement);
  if (!card) return toast.error("Card input not found");

  try {
    setLoading(true);

    const result = await stripe.confirmCardPayment(clientSecret, {
      payment_method: { card },
    });

    // ❌ Payment failed
    if (result.error) {
      setPaymentFailed(true);
      toast.error(result.error.message || "Payment failed");
      return;
    }

    // ✅ Payment succeeded (Stripe-confirmed)
    if (result.paymentIntent?.status === "succeeded") {
      if (confirmedRef.current) return;
      confirmedRef.current = true;

      localStorage.removeItem(`payment_${bookingId}`);

      // 🔥 IMPORTANT CHANGE:
      // ❌ DO NOT call /bookings/confirm
      // ✅ Just redirect (Webhook will confirm booking)
      navigate(`/payment/success/${bookingId}`, { replace: true });
    }
  } catch (err) {
    console.error("Payment error:", err?.response?.data || err.message);
    toast.error("Something went wrong during payment");
  } finally {
    setLoading(false);
  }
};

  // ✅ Cancel Payment
  const handleCancel = async () => {
    try {
      setLoading(true);
      await unlockSeats();
      toast("Payment cancelled, seats released");
      navigate(`/shows/${showId}/seats`, { replace: true });
    } catch (err) {
      console.log("Cancel error:", err?.response?.data || err.message);
      toast.error("Failed to cancel payment");
    } finally {
      setLoading(false);
    }
  };

  // ✅ Back button (go to my-bookings)
  const handleBack = () => {
    navigate("/my-bookings");
  };

  if (!showId || seats.length === 0) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center text-gray-600 bg-white">
        No seats selected.
      </div>
    );
  }

  return (
    <div className="min-h-[85vh] bg-white px-6 md:px-16 lg:px-40 pt-28 pb-24">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-gray-900">
            Complete your payment
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Your seats are temporarily locked. Finish payment to confirm booking.
          </p>
        </div>

        <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-700">
          <ShieldCheck className="w-4 h-4 text-green-600" />
          Secure payment powered by Stripe
        </div>
      </div>

      {/* Layout */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Payment Card */}
        <div className="lg:col-span-2 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-gray-700" />
            <h2 className="text-lg font-semibold text-gray-900">Card details</h2>
          </div>

          <p className="text-xs text-gray-500 mt-2">
            Use test card:{" "}
            <span className="text-gray-900 font-medium">
              4242 4242 4242 4242
            </span>{" "}
            (any future date, any CVC)
          </p>

          {/* Stripe Card */}
          <div className="mt-5 rounded-xl border border-gray-200 bg-gray-50 p-4">
            <CardElement
              options={{
                disabled: isExpired,
                style: {
                  base: {
                    fontSize: "16px",
                    color: "#111827",
                    "::placeholder": { color: "#6b7280" },
                  },
                },
              }}
            />
          </div>

          {paymentFailed && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3">
              <p className="text-sm text-red-600">
                Payment failed. Your seats are still locked. Please try again.
              </p>
            </div>
          )}

          {!clientSecret && (
            <p className="text-xs text-gray-500 mt-4">Initializing payment...</p>
          )}

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            {!isExpired && (
              <button
                disabled={!stripe || !elements || !clientSecret || loading}
                onClick={handlePayNow}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 transition font-semibold text-white disabled:opacity-50"
              >
                {loading
                  ? "Processing..."
                  : paymentFailed
                  ? "Retry Payment"
                  : "Pay Now"}
              </button>
            )}

            <button
              disabled={loading}
              onClick={handleBack}
              className="w-full sm:w-auto px-6 py-3 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition font-semibold text-gray-800 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>

            <button
              disabled={loading}
              onClick={handleCancel}
              className="w-full sm:w-auto px-6 py-3 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition font-semibold text-gray-800 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <XCircle className="w-4 h-4" />
              Cancel
            </button>
          </div>

          {isExpired && (
            <p className="text-sm text-red-600 font-medium mt-4">
              Time expired. Please select seats again.
            </p>
          )}
        </div>

        {/* Right: Summary */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm h-fit">
          <h2 className="text-lg font-semibold text-gray-900">Order summary</h2>

          <div className="mt-4 space-y-3 text-sm text-gray-700">
            <div className="flex items-center justify-between">
              <span className="text-gray-500 flex items-center gap-2">
                <Ticket className="w-4 h-4" />
                Seats
              </span>
              <span className="text-gray-900 font-semibold">{totalSeats}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-gray-500">Selected</span>
              <span className="text-gray-900 font-medium text-right">
                {seats.join(", ")}
              </span>
            </div>

            <div className="h-px bg-gray-200 my-2" />

            <div className="flex items-center justify-between">
              <span className="text-gray-500 flex items-center gap-2">
                <IndianRupee className="w-4 h-4" />
                Amount
              </span>
              <span className="text-gray-900 font-bold text-base">₹{amount}</span>
            </div>

            <div
              className={`mt-3 rounded-xl border p-3 ${
                dangerTimer
                  ? "border-red-200 bg-red-50"
                  : "border-gray-200 bg-gray-50"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-gray-600 flex items-center gap-2">
                  <Clock3 className="w-4 h-4" />
                  Time left
                </span>
                <span
                  className={`font-semibold ${
                    dangerTimer ? "text-red-600" : "text-gray-900"
                  }`}
                >
                  {String(minutes).padStart(2, "0")}:
                  {String(seconds).padStart(2, "0")}
                </span>
              </div>

              <p className="text-xs text-gray-500 mt-2">
                If time expires, seats will be released automatically.
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-gray-200 bg-gray-50 p-3">
            <p className="text-xs text-gray-500">
              Booking for show:{" "}
              <span className="text-gray-900 font-medium">{showId}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Payment;