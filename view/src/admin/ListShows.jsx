import React from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import Loading from "../components/Loading";
import Title from "../admincomponents/Title";
import { dateFormat } from "../lib/dateFormat";
import api from "../api/api";
import { toast } from "react-hot-toast";

const LIMIT = 20;

const fetchShows = async ({ pageParam = null }) => {
  const { data } = await api.get("/shows/all", {
    params: {
      limit: LIMIT,
      cursor: pageParam,
    },
  });

  if (!data?.success) {
    return { shows: [], nextCursor: null, hasNextPage: false };
  }

  return data;
};

const statusColor = {
  UPCOMING: "text-green-400",
  RUNNING: "text-yellow-400",
  ENDED: "text-red-400",
};

const ListShows = () => {
  const currency = import.meta.env.VITE_CURRENCY || "₹";

  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["adminShows", { limit: LIMIT }],
    queryFn: fetchShows,
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage?.nextCursor ?? undefined,
    staleTime: 60 * 1000,
    onError: () => toast.error("Failed to load shows"),
  });

  const shows = data?.pages?.flatMap((page) => page.shows) || [];

  if (isLoading) return <Loading />;

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <h1 className="text-xl font-semibold text-red-500">
          Failed to load shows
        </h1>
      </div>
    );
  }

  return (
    <>
      <Title text1="List" text2="Shows" />

      <div className="max-w-6xl mt-6 overflow-x-auto">
        <table className="w-full border-collapse rounded-md overflow-hidden text-nowrap">
          <thead>
            <tr className="bg-primary/20 text-left text-white">
              <th className="p-2 font-medium">Movie</th>
              <th className="p-2 font-medium">Theatre</th>
              <th className="p-2 font-medium">Screen</th>
              <th className="p-2 font-medium">Show Time</th>
              <th className="p-2 font-medium">Status</th>
              <th className="p-2 font-medium">Tickets Sold</th>
              <th className="p-2 font-medium">Earnings</th>
            </tr>
          </thead>

          <tbody className="text-sm font-light">
            {shows.length === 0 ? (
              <tr>
                <td className="p-3 text-gray-400" colSpan={7}>
                  No shows found
                </td>
              </tr>
            ) : (
              shows.map((show) => (
                <tr
                  key={show.id}
                  className="border-b border-primary/10 bg-primary/5 even:bg-primary/10"
                >
                  <td className="p-2 pl-5">
                    {show.movie?.title || "N/A"}
                  </td>

                  <td className="p-2">
                    {show.theatre?.name || "—"}
                  </td>

                  <td className="p-2">
                    {show.screen?.name || "—"}
                  </td>

                  <td className="p-2">
                    {dateFormat(show.startTime)}
                  </td>

                  <td className={`p-2 font-semibold ${statusColor[show.status]}`}>
                    {show.status}
                  </td>

                  <td className="p-2">
                    {show.stats?.ticketsSold ?? 0}
                  </td>

                  <td className="p-2">
                    {currency} {show.earnings?.amount ?? 0}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Load More */}
        {shows.length > 0 && (
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
              <p className="text-sm text-gray-400 mt-3">No more shows</p>
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default ListShows;