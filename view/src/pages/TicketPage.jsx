import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import api from "../api/api";
import Loading from "../components/Loading";
import BlurCircle from "../components/BlurCircle";
import { toast } from "react-hot-toast";
import QRCode from "react-qr-code";
import { dateFormat } from "../lib/dateFormat";

const fetchBookingById = async (id) => {
  const { data } = await api.get(`/bookings/${id}`);
  if (!data?.success) throw new Error("Failed to load ticket");
  return data.booking;
};

const TicketPage = () => {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const currency = import.meta.env.VITE_CURRENCY || "₹";

  const {
    data: booking,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["ticket", bookingId],
    queryFn: () => fetchBookingById(bookingId),
    enabled: !!bookingId,
    onError: () => toast.error("Ticket not found"),
  });

  if (isLoading) return <Loading />;

  if (isError || !booking) {
    return (
      <div className="relative px-6 md:px-16 lg:px-40 pt-32 md:pt-40 min-h-[80vh]">
        <BlurCircle top="100px" left="100px" />
        <h1 className="text-lg font-semibold mb-4">Ticket</h1>
        <p className="text-gray-400 text-sm">Ticket not found.</p>

        <button
          onClick={() => navigate("/my-bookings")}
          className="mt-4 bg-white/10 hover:bg-white/20 border border-white/10 px-4 py-2 text-sm rounded-lg font-medium"
        >
          Back to My Bookings
        </button>
      </div>
    );
  }

  const qrValue = `BOOKING_ID:${booking.id}`;

  return (
    <div className="relative px-6 md:px-16 lg:px-40 pt-32 md:pt-40 min-h-[80vh]">
      <BlurCircle top="100px" left="100px" />
      <BlurCircle bottom="0px" left="600px" />

      <div className="max-w-3xl bg-primary/8 border border-primary/20 rounded-xl p-6">
        <div className="flex flex-col md:flex-row justify-between gap-6">
          {/* LEFT DETAILS */}
          <div className="flex-1">
            <h1 className="text-xl font-semibold">
              {booking?.show?.movie?.title || "Movie Ticket"}
            </h1>

            <p className="text-gray-400 text-sm mt-1">
              Booking ID: <span className="text-white">{booking.id}</span>
            </p>

            <p className="text-gray-400 text-sm mt-3">
              <span className="text-gray-400">Theatre:</span>{" "}
              {booking?.show?.screen?.theatre?.name || "Theatre"}
            </p>

            <p className="text-gray-400 text-sm">
              <span className="text-gray-400">Screen:</span>{" "}
              {booking?.show?.screen?.name || "Screen"}
            </p>

            <p className="text-gray-400 text-sm mt-3">
              <span className="text-gray-400">Show Time:</span>{" "}
              {dateFormat(booking?.show?.startTime)}
            </p>

            <p className="text-gray-400 text-sm mt-3">
              <span className="text-gray-400">Seats:</span>{" "}
              {booking?.bookedSeats?.join(", ") || "None"}
            </p>

            <p className="text-gray-400 text-sm">
              <span className="text-gray-400">Tickets:</span>{" "}
              {booking?.bookedSeats?.length || 0}
            </p>

            <p className="text-gray-400 text-sm mt-3">
              <span className="text-gray-400">Payment:</span>{" "}
              {booking?.isPaid ? "Paid ✅" : "Pending ⏳"}
            </p>

            <p className="text-lg font-semibold mt-4">
              Total: {currency}
              {booking?.totalAmount}
            </p>

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => window.print()}
                className="bg-primary px-4 py-2 text-sm rounded-lg font-medium"
              >
                Download / Print
              </button>

              <button
                onClick={() => navigate("/my-bookings")}
                className="bg-white/10 hover:bg-white/20 border border-white/10 px-4 py-2 text-sm rounded-lg font-medium"
              >
                Back
              </button>
            </div>
          </div>

          {/* RIGHT QR */}
          <div className="flex flex-col items-center justify-center bg-white p-4 rounded-lg w-fit">
            <QRCode value={qrValue} size={160} />
            <p className="text-black text-xs mt-2 font-medium">
              Scan at Entry
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TicketPage;