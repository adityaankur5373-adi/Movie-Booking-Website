import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import api from "../api/api";
import Loading from "../components/Loading";
import BlurCircle from "../components/BlurCircle";
import { MapPin, Monitor } from "lucide-react";

const fetchMyBookings = async () => {
  const { data } = await api.get("/bookings/me");
  return data.bookings || [];
};

const MyBookings = () => {
  const navigate = useNavigate();
  const [payingId, setPayingId] = useState(null);

  const {
    data: bookings = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["myBookings"],
    queryFn: fetchMyBookings,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  if (isLoading) return <Loading />;

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-white">
        <p className="text-lg font-medium">Failed to load bookings</p>
        <p className="text-sm text-gray-400 mt-2">
          {error?.response?.data?.message || "Please try again"}
        </p>
      </div>
    );
  }

  return bookings.length > 0 ? (
    <div className="relative my-40 mb-60 px-6 md:px-16 lg:px-40 xl:px-44 overflow-hidden min-h-[80vh]">
      <BlurCircle top="120px" left="0px" />
      <BlurCircle bottom="120px" right="0px" />

      <h1 className="text-lg font-medium my-6 text-white">
        My Bookings
      </h1>

      <div className="flex flex-col gap-6">
        {bookings.map((item) => {
          const show = item.show;
          const movie = show.movie;
          const screen = show.screen;
          const theatre = screen?.theatre;

          // ✅ STATUS FLAGS (LOGIC ONLY)
          const isPending = item.status === "PENDING" && !item.isPaid;
          const isExpired = item.status === "EXPIRED";
          const isCancelled = item.status === "CANCELLED";
          const isConfirmed = item.status === "CONFIRMED" && item.isPaid;

          return (
            <div
              key={item.id}
              className="relative overflow-hidden rounded-2xl border border-white/10 
                         bg-gradient-to-r from-[#1a0f14]/80 to-[#2a0f18]/80 
                         backdrop-blur-xl shadow-lg"
            >
              <div className="flex flex-col md:flex-row items-center justify-between gap-6 p-6">
                {/* LEFT */}
                <div className="flex gap-6 items-center">
                  {movie.posterPath && (
                    <img
                      src={movie.posterPath}
                      alt={movie.title}
                      className="w-24 h-32 rounded-xl object-cover"
                    />
                  )}

                  <div className="text-white">
                    <p className="text-lg font-semibold">
                      {movie.title}
                    </p>

                    <p className="text-sm text-gray-300 mt-1">
                      {Math.floor(movie.runtime / 60)}h{" "}
                      {movie.runtime % 60}m
                    </p>

                    <p className="text-sm text-gray-400 mt-2">
                      {new Date(show.startTime).toLocaleString()}
                    </p>

                    <div className="mt-3 space-y-1 text-sm text-gray-300">
                      <p className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {theatre?.name}
                      </p>

                      <p className="flex items-center gap-1">
                        <Monitor className="w-4 h-4" />
                        Screen: {screen?.name}
                      </p>
                    </div>
                  </div>
                </div>

                {/* RIGHT */}
                <div className="text-right text-white space-y-2">
                  <p className="text-2xl font-semibold">
                    ₹{item.totalAmount || 0}
                  </p>

                  <p className="text-sm text-gray-400">
                    Total Tickets: {item.bookedSeats.length}
                  </p>

                  <p className="text-sm text-gray-400">
                    Seat Number: {item.bookedSeats.join(", ")}
                  </p>

                  {/* 🟡 EXPIRED */}
                  {isExpired && (
                    <span className="inline-block mt-3 px-4 py-1.5 
                                     rounded-full text-xs font-medium 
                                     bg-gray-500/20 text-gray-400">
                      Expired
                    </span>
                  )}

                  {/* 🔴 CANCELLED */}
                  {isCancelled && (
                    <span className="inline-block mt-3 px-4 py-1.5 
                                     rounded-full text-xs font-medium 
                                     bg-red-500/20 text-red-400">
                      Cancelled
                    </span>
                  )}

                  {/* 🔵 PENDING */}
                  {isPending && (
                    <button
                      disabled={payingId === item.id}
                      onClick={() => {
                        setPayingId(item.id);
                        navigate(`/checkout/${item.id}`);
                      }}
                      className="mt-3 px-6 py-2 rounded-full 
                                 bg-gradient-to-r from-pink-500 to-red-500 
                                 hover:from-pink-600 hover:to-red-600 
                                 transition font-semibold text-sm"
                    >
                      Pay Now
                    </button>
                  )}

                  {/* 🟢 CONFIRMED */}
                  {isConfirmed && (
                    <span className="inline-block mt-3 px-4 py-1.5 
                                     rounded-full text-xs font-medium 
                                     bg-green-500/20 text-green-400">
                      Confirmed
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  ) : (
    <div className="flex flex-col items-center justify-center h-screen text-white">
      <h1 className="text-3xl font-semibold">No bookings yet 🎟️</h1>
    </div>
  );
};

export default MyBookings;