import React from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import Loading from "../components/Loading";
import Title from "../admincomponents/Title";
import { dateFormat } from "../lib/dateFormat";
import api from "../api/api";
import { toast } from "react-hot-toast";

const LIMIT = 20;

const fetchBookings = async ({ pageParam = null }) => {
  const { data } = await api.get("/bookings/all", {
    params: {
      limit: LIMIT,
      cursor: pageParam,
    },
  });

  if (!data?.success) {
    return { bookings: [], nextCursor: null, hasNextPage: false };
  }

  return data;
};

const ListBooking = () => {
  const currency = import.meta.env.VITE_CURRENCY || "₹";

  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["adminBookings", { limit: LIMIT }],
    queryFn: fetchBookings,
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage?.nextCursor ?? undefined,
    staleTime: 60 * 1000,
    onError: () => toast.error("Failed to fetch bookings"),
  });

  const bookings = data?.pages?.flatMap((page) => page.bookings) || [];

  if (isLoading) return <Loading />;

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <h1 className="text-xl font-semibold text-red-500">
          Failed to load bookings
        </h1>
      </div>
    );
  }

  return (
    <>
      <Title text1="List" text2="Booking" />

      <div className="max-w-4xl mt-6 overflow-x-auto">
        <table className="w-full border-collapse rounded-md overflow-hidden text-nowrap">
          <thead>
            <tr className="bg-primary/20 text-left text-white">
              <th className="p-2 font-medium">User Name</th>
              <th className="p-2 font-medium">Movie Name</th>
              <th className="p-2 font-medium">Show Time</th>
              <th className="p-2 font-medium">Seats</th>
              <th className="p-2 font-medium">Amount</th>
            </tr>
          </thead>

          <tbody className="text-sm font-light">
            {bookings.map((item, index) => (
              <tr
                key={item.id || index}
                className="border-b border-primary/20 bg-primary/5 even:bg-primary/10"
              >
                <td className="p-2 min-w-45 pl-5">
                  {item?.user?.name || item?.user?.email || "User"}
                </td>

                <td className="p-2">{item?.show?.movie?.title || "Movie"}</td>

                <td className="p-2">{dateFormat(item?.show?.startTime)}</td>

                <td className="p-2">
                  {item?.bookedSeats?.length > 0
                    ? item.bookedSeats.join(", ")
                    : "None"}
                </td>

                <td className="p-2">
                  {currency} {item?.totalAmount ?? 0}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {bookings.length === 0 && (
          <p className="text-gray-400 text-sm mt-4">No bookings found.</p>
        )}

        {/* Load More */}
        {bookings.length > 0 && (
          <div className="flex justify-center mt-6">
            {hasNextPage ? (
              <button
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="px-6 py-3 rounded-xl bg-primary hover:bg-primary-dull transition font-semibold disabled:opacity-50"
              >
                {isFetchingNextPage ? "Loading..." : "Load More"}
              </button>
            ) : (
              <p className="text-sm text-gray-400 mt-3">No more bookings</p>
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default ListBooking;