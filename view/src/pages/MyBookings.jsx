import { useEffect, useState } from "react";
import Loading from "../components/Loading";
import BlurCircle from "../components/BlurCircle";
import timeFormat from "../lib/timeFormat";
import { dateFormat } from "../lib/dateFormat";
import api from "../api/api";
import { toast } from "react-hot-toast";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

const TTL_MS = 5 * 60 * 1000; // 5 minutes

const fetchMyBookings = async () => {
  const { data } = await api.get("/bookings/me");
  if (!data?.success) return [];
  return data.bookings || [];
};

const MyBookings = () => {
  const currency = import.meta.env.VITE_CURRENCY || "₹";
  const navigate = useNavigate();

  // ✅ Auto rerender every second so timer updates live
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const {
    data: bookings = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["myBookings"],
    queryFn: fetchMyBookings,
    staleTime: 20 * 1000,
    onError: () => toast.error("Failed to load bookings"),
  });

  if (isLoading) return <Loading />;

  if (isError) {
    return (
      <div className="relative px-6 md:px-16 lg:px-40 pt-32 md:pt-40 min-h-[80vh]">
        <BlurCircle top="100px" left="100px" />
        <div>
          <BlurCircle bottom="0px" left="600px" />
        </div>

        <h1 className="text-lg font-semibold mb-4">My Bookings</h1>
        <p className="text-gray-400 text-sm">Failed to load bookings.</p>
      </div>
    );
  }

  return (
    <div className="relative px-6 md:px-16 lg:px-40 pt-32 md:pt-40 min-h-[80vh]">
      <BlurCircle top="100px" left="100px" />
      <div>
        <BlurCircle bottom="0px" left="600px" />
      </div>

      <h1 className="text-lg font-semibold mb-4">My Bookings</h1>

      {bookings.length === 0 ? (
        <p className="text-gray-400 text-sm">No bookings found.</p>
      ) : (
        bookings.map((item, index) => {
          // ✅ Timer check for each booking
          const saved = localStorage.getItem(`payment_${item.id}`);
          const parsed = saved ? JSON.parse(saved) : null;

          const timeLeft = parsed?.createdAt
            ? TTL_MS - (Date.now() - parsed.createdAt)
            : TTL_MS;

          const isExpired = timeLeft <= 0;

          return (
            <div
              key={item.id || index}
              className="flex flex-col md:flex-row justify-between bg-primary/8 border border-primary/20 rounded-lg mt-4 p-2 max-w-3xl"
            >
              {/* LEFT SIDE */}
              <div className="flex flex-col md:flex-row">
                {/* Poster */}
                {item?.show?.movie?.posterPath ? (
                  <img
                    src={item.show.movie.posterPath}
                    alt=""
                    className="md:max-w-[180px] aspect-video h-auto object-cover object-bottom rounded"
                  />
                ) : (
                  <div className="md:max-w-[180px] aspect-video h-auto rounded bg-white/5 border border-white/10 flex items-center justify-center text-xs text-gray-400">
                    No Poster
                  </div>
                )}

                <div className="flex flex-col p-4">
                  <p className="text-lg font-semibold">
                    {item?.show?.movie?.title || "Movie"}
                  </p>

                  {/* Runtime */}
                  {item?.show?.movie?.runtime ? (
                    <p className="text-gray-400 text-sm">
                      {timeFormat(item.show.movie.runtime)}
                    </p>
                  ) : (
                    <p className="text-gray-400 text-sm">
                      {item?.show?.screen?.theatre?.name || "Theatre"} •{" "}
                      {item?.show?.screen?.name || "Screen"}
                    </p>
                  )}

                  <p className="text-gray-400 text-sm mt-2">
                    {item?.show?.screen?.theatre?.name || "Theatre"} •{" "}
                    {item?.show?.screen?.name || "Screen"}
                  </p>

                  <p className="text-gray-400 text-sm mt-auto">
                    {dateFormat(item?.show?.startTime)}
                  </p>
                </div>
              </div>

              {/* RIGHT SIDE */}
              <div className="flex flex-col md:items-end md:text-right justify-between p-4">
                <div className="flex items-center gap-4">
                  <p className="text-2xl font-semibold mb-3">
                    {currency}
                    {item?.totalAmount}
                  </p>

                  {/* ✅ Show Pay Now only if pending + NOT expired */}
                  {!item?.isPaid && !isExpired && (
                    <button
                      onClick={() => {
                        navigate(`/payment/${item.showId}`, {
                          state: {
                            bookingId: item.id,
                            seats: item.bookedSeats,
                            fromBookingPage: true,
                          },
                        });
                      }}
                      className="bg-primary px-4 py-1.5 mb-3 text-sm rounded-full font-medium cursor-pointer"
                    >
                      Pay Now
                    </button>
                  )}

                  {/* ✅ Expired message */}
                  {!item?.isPaid && isExpired && (
                    <p className="text-red-500 text-sm font-medium mb-3">
                      Payment expired
                    </p>
                  )}
                </div>

                <div className="text-sm space-y-1">
                  <p>
                    <span className="text-gray-400">Tickets:</span>{" "}
                    {item?.bookedSeats?.length || 0}
                  </p>

                  <p>
                    <span className="text-gray-400">Seats:</span>{" "}
                    {item?.bookedSeats?.join(", ") || "None"}
                  </p>

                  <p>
                    <span className="text-gray-400">Payment:</span>{" "}
                    {item?.isPaid ? "Paid" : "Pending"}
                  </p>
                </div>

                {/* ✅ View Ticket */}
                {item?.isPaid && (
                  <button
                    onClick={() => navigate(`/ticket/${item.id}`)}
                    className="mt-3 text-sm underline"
                  >
                    View Ticket
                  </button>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};

export default MyBookings;