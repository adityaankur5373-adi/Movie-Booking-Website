import React from "react";
import { StarIcon, ClockIcon } from "lucide-react";
import timeFormat from "../lib/timeFormat";
import isoTimeFormat from "../lib/isoTimeFormat";

const TheatreMovieCard = ({ movie, shows = [], onSelectShow }) => {
  const title = movie?.title || movie?.name || "Untitled";

  const backdrop =
    movie?.backdrop_path ||
    movie?.backdropPath ||
    movie?.posterPath ||
    movie?.poster_path ||
    "";

  const releaseDate = movie?.release_date || movie?.releaseDate;
  const year = releaseDate ? new Date(releaseDate).getFullYear() : "N/A";

  const genres = movie?.genres || [];
  const genreText =
    Array.isArray(genres) && genres.length > 0
      ? genres
          .slice(0, 2)
          .map((g) => g?.name)
          .filter(Boolean)
          .join(" | ")
      : "N/A";

  const runtime = movie?.runtime ? timeFormat(movie.runtime) : "N/A";

  const rating =
    typeof movie?.vote_average === "number"
      ? movie.vote_average.toFixed(1)
      : typeof movie?.voteAverage === "number"
      ? movie.voteAverage.toFixed(1)
      : "N/A";

  return (
    <div className="flex flex-col justify-between p-3 bg-gray-800 rounded-2xl hover:-translate-y-1 transition duration-300 w-66">
      <img
        src={backdrop}
        alt={title}
        className="rounded-lg h-52 w-full object-cover object-bottom-right"
      />

      <p className="font-semibold mt-2 truncate">{title}</p>

      <p className="text-sm text-gray-400 mt-2">
        {year} · {genreText} · {runtime}
      </p>

      {/* Show Times */}
      <div className="flex flex-wrap gap-2 mt-4 pb-3">
        {shows?.map((s) => {
          const screenName = s?.screen?.name ?? "Screen";
          const hasStarted = s?.hasStarted ?? false;
          const isBookable = s?.isBookable ?? false;

          return (
            <button
              key={s.id}
              disabled={!isBookable}
              onClick={() =>
                isBookable && onSelectShow?.(s.id, s.startTime)
              }
              className={`flex items-center gap-1 px-3 py-2 text-xs border transition 
                rounded-full font-medium active:scale-95
                ${
                  !isBookable
                    ? "border-white/10 text-gray-500 bg-black/30 cursor-not-allowed"
                    : "border-white/30 text-white hover:bg-white hover:text-black cursor-pointer"
                }`}
            >
              <ClockIcon className="w-4 h-4" />
              {isoTimeFormat(s.startTime)}
              <span className="text-xs opacity-70">
                ({screenName})
              </span>
            </button>
          );
        })}
      </div>

      <p className="flex items-center gap-1 text-sm text-gray-400 mt-1 pr-1">
        <StarIcon className="w-4 h-4 text-primary fill-primary" />
        {rating}
      </p>
    </div>
  );
};

export default TheatreMovieCard;
