import React from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import Moviecard from "../components/Moviecard";
import BlurCircle from "../components/BlurCircle";
import api from "../api/api";
import Loading from "../components/Loading";

const LIMIT = 12;

const fetchMovies = async ({ pageParam = null }) => {
  const { data } = await api.get("/movies", {
    params: {
      limit: LIMIT,
      cursor: pageParam,
    },
  });

  if (!data?.success) {
    return { movies: [], nextCursor: null, hasNextPage: false };
  }

  return data;
};

const Movies = () => {
  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["movies", { limit: LIMIT }],
    queryFn: fetchMovies,
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage?.nextCursor ?? undefined,
    staleTime: 60 * 1000,
  });

  const movies = data?.pages?.flatMap((page) => page.movies) || [];

  if (isLoading) return <Loading />;

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <h1 className="text-2xl font-bold text-center text-red-400">
          Failed to load movies
        </h1>
      </div>
    );
  }

  return movies.length > 0 ? (
    <div className="relative my-40 mb-60 px-6 md:px-16 lg:px-40 xl:px-44 overflow-hidden min-h-[80vh]">
      <BlurCircle top="150px" left="0px" />
      <BlurCircle bottom="150px" right="0px" />

      <h1 className="text-lg font-medium my-4">Now Showing</h1>

      <div className="flex flex-wrap max-sm:justify-center gap-8">
        {movies.map((movie) => (
          <Moviecard movie={movie} key={movie.id} />
        ))}
      </div>

      {/* Load More Button */}
      <div className="flex justify-center mt-10">
        {hasNextPage ? (
          <button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="px-6 py-3 rounded-xl bg-primary hover:bg-primary-dull transition font-semibold disabled:opacity-50"
          >
            {isFetchingNextPage ? "Loading..." : "Load More"}
          </button>
        ) : (
          <p className="text-sm text-gray-400 mt-4">No more movies 🎬</p>
        )}
      </div>
    </div>
  ) : (
    <div className="flex flex-col items-center justify-center h-screen">
      <h1 className="text-5xl font-bold text-center">No movies available</h1>
    </div>
  );
};

export default Movies;