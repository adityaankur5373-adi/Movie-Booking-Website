import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api/api";
import {
  CheckCircle2,
  Loader2,
  Ticket,
  ArrowRight,
} from "lucide-react";

const POLL_INTERVAL = 2000;      // 2 seconds
const MAX_POLL_TIME = 60_000;    // 1 minute max

const PaymentSuccess = () => {
  const { bookingId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let intervalId;
    let timeoutId;
    let isMounted = true;

    const fetchBooking = async () => {
      try {
        const { data } = await api.get(`/bookings/${bookingId}`);

        if (!isMounted) return;

        if (data?.booking?.status === "CONFIRMED") {
          setBooking(data.booking);
          setLoading(false);

          clearInterval(intervalId);
          clearTimeout(timeoutId);
        }
      } catch (err) {
        // do NOT crash UI – webhook may still arrive
        console.warn("Waiting for booking confirmation...");
      }
    };

    // initial fetch
    fetchBooking();

    // poll every 2 seconds
    intervalId = setInterval(fetchBooking, POLL_INTERVAL);

    // hard stop after 1 minute
    timeoutId = setTimeout(() => {
      if (!isMounted) return;

      clearInterval(intervalId);
      setLoading(false);
      setError("Payment completed, but booking confirmation is taking longer than expected.");
    }, MAX_POLL_TIME);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
      clearTimeout(timeoutId);
    };
  }, [bookingId]);

  /* ---------------- Loading State ---------------- */
  if (loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center bg-white px-4">
        <div className="flex flex-col items-center text-center">
          <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
          <h2 className="mt-4 text-lg font-semibold text-gray-900">
            Confirming your booking
          </h2>
          <p className="mt-1 text-sm text-gray-500 max-w-sm">
            Please wait while we finalize your payment and confirm your seats.
          </p>
        </div>
      </div>
    );
  }

  /* ---------------- Timeout / Error State ---------------- */
  if (error) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <h2 className="text-xl font-semibold text-gray-900">
            Almost there!
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            {error}
          </p>

          <div className="mt-6 flex flex-col gap-3">
            <button
              onClick={() => navigate("/my-bookings")}
              className="rounded-xl bg-blue-600 px-6 py-3 text-white font-semibold"
            >
              Go to My Bookings
            </button>
            <button
              onClick={() => navigate("/")}
              className="rounded-xl border px-6 py-3"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ---------------- Success State ---------------- */
  return (
    <div className="min-h-[85vh] bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-sm border p-8 text-center">
        <CheckCircle2 className="mx-auto w-14 h-14 text-green-600" />

        <h1 className="mt-4 text-2xl font-semibold text-gray-900">
          Payment Successful
        </h1>

        <p className="mt-2 text-sm text-gray-600">
          Your payment has been received and your booking is confirmed.
        </p>

        <div className="my-6 h-px bg-gray-200" />

        <div className="space-y-2 text-sm text-gray-700">
          <div className="flex justify-between">
            <span className="text-gray-500">Booking ID</span>
            <span className="font-medium">{booking?.id}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-gray-500">Status</span>
            <span className="inline-flex items-center gap-1 text-green-600 font-medium">
              <Ticket className="w-4 h-4" />
              Confirmed
            </span>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3">
          <button
            onClick={() => navigate("/my-bookings")}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-white font-semibold"
          >
            View My Bookings
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            onClick={() => navigate("/")}
            className="w-full rounded-xl border px-6 py-3"
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccess;