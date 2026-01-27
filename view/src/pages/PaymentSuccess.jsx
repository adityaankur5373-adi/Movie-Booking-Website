import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api/api";
import {
  CheckCircle2,
  Loader2,
  Ticket,
  ArrowRight,
} from "lucide-react";

const PaymentSuccess = () => {
  const { bookingId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(null);

  useEffect(() => {
    let interval;

    const fetchBooking = async () => {
      try {
        const { data } = await api.get(`/bookings/${bookingId}`);

        if (data?.booking?.status === "CONFIRMED") {
          setBooking(data.booking);
          clearInterval(interval);
          setLoading(false);
        }
      } catch {
        // silently wait for webhook
      }
    };

    fetchBooking();
    interval = setInterval(fetchBooking, 2000);

    return () => clearInterval(interval);
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
            Please wait a moment while we finalize your payment and confirm
            your seats.
          </p>
        </div>
      </div>
    );
  }

  /* ---------------- Success State ---------------- */
  return (
    <div className="min-h-[85vh] bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-sm border border-gray-200 p-8 text-center">
        <CheckCircle2 className="mx-auto w-14 h-14 text-green-600" />

        <h1 className="mt-4 text-2xl font-semibold text-gray-900">
          Payment Successful
        </h1>

        <p className="mt-2 text-sm text-gray-600">
          Your payment has been received and your booking is confirmed.
          A confirmation email with your ticket has been sent.
        </p>

        {/* Divider */}
        <div className="my-6 h-px bg-gray-200" />

        {/* Booking Info */}
        <div className="space-y-2 text-sm text-gray-700">
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Booking ID</span>
            <span className="font-medium">{booking?.id}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-gray-500">Status</span>
            <span className="inline-flex items-center gap-1 text-green-600 font-medium">
              <Ticket className="w-4 h-4" />
              Confirmed
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-8 flex flex-col gap-3">
          <button
            onClick={() => navigate("/my-bookings")}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-white font-semibold hover:bg-blue-700 transition"
          >
            View My Bookings
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            onClick={() => navigate("/")}
            className="w-full rounded-xl border border-gray-200 bg-white px-6 py-3 text-gray-800 font-medium hover:bg-gray-50 transition"
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccess;