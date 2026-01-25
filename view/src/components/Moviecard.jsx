import React, { memo, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { StarIcon, HeartIcon } from "lucide-react";
import timeFormat from "../lib/timeFormat";
import { useQueryClient } from "@tanstack/react-query";

const Moviecard = ({ movie }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // ✅ Read favourites from React Query cache (no API call)
  const favourites = queryClient.getQueryData(["favourites"]) || [];

  const isFav = useMemo(() => {
    return favourites.some((m) => m.id === movie.id);
  }, [favourites, movie.id]);

  const genresText = useMemo(() => {
    return (movie.genres || []).slice(0,2).map((g) => g.name).join(" | ");
  }, [movie.genres]);

  const year = useMemo(() => {
    if (!movie.releaseDate) return "N/A";
    return new Date(movie.releaseDate).getFullYear();
  }, [movie.releaseDate]);

  return (
    <div className="flex flex-col justify-between p-3 bg-gray-800 rounded-2xl hover:-translate-y-1 transition duration-300 w-66">
      <div className="relative">
        <img
          onClick={() => {
            navigate(`/movies/${movie.id}`);
            scrollTo(0, 0);
          }}
          src={movie.posterPath}
          alt=""
          className="rounded-lg h-52 w-full object-cover object-bottom-right cursor-pointer"
        />

        {/* ✅ Favourite badge */}
      </div>

      <p className="font-semibold mt-2 truncate">{movie.title}</p>

      <p className="text-sm text-gray-400 mt-2">
        {year} · {genresText} · {timeFormat(movie.runtime)}
      </p>

      <div className="flex item-center justify-between mt-4 pb-3">
        <button
          onClick={() => {
            navigate(`/movies/${movie.id}`);
            scrollTo(0, 0);
          }}
          className="px-4 py-2 text-xs bg-primary hover:bg-primary-dull transition rounded-full font-medium cursor-pointer"
        >
          Buy Tickets
        </button>

        <p className="flex items-center gap-1 text-sm text-gray-400 mt-1 pr-1">
          <StarIcon className="w-4 h-4 text-primary fill-primary" />
          {movie?.voteAverage?.toFixed(1) ?? "N/A"}
        </p>
      </div>
    </div>
  );
};

export default memo(Moviecard);
