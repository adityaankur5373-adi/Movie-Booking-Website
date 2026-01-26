import React, { useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import BlurCircle from "../components/BlurCircle";
import { StarIcon, HeartIcon, PlayCircleIcon } from "lucide-react";
import timeFormat from "../lib/timeFormat";
import DateSelect from "../components/DateSelect";
import Moviecard from "../components/Moviecard";
import Loading from "../components/Loading";
import api from "../api/api";
import { toast } from "react-hot-toast";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const fetchMovie = async (id) => {
  const { data } = await api.get(`/movies/${id}`);
  if (!data?.success) throw new Error("Movie not found");
  return data.movie;
};

const fetchShowsByMovie = async (id) => {
  const { data } = await api.get(`/shows/movie/${id}`);
  return data?.shows || [];
};

const fetchRelatedMovies = async (id) => {
  const { data } = await api.get(`/movies`, { params: { limit: 4 } });
  if (!data?.success) return [];
  return (data.movies || []).filter((m) => m.id !== id);
};

const fetchFavouriteStatus = async (id) => {
  const { data } = await api.get(`/favourites/${id}`);
  return data?.isFavourite || false;
};

const MovieDetails = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const queryClient = useQueryClient();

  // ✅ Movie details
  const { data: movie, isLoading: movieLoading } = useQuery({
    queryKey: ["movie", id],
    queryFn: () => fetchMovie(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });

  // ✅ Shows by movie
  const { data: shows = [], isLoading: showsLoading } = useQuery({
    queryKey: ["showsByMovie", id],
    queryFn: () => fetchShowsByMovie(id),
    enabled: !!id,
    staleTime: 30 * 1000,
  });
   console.log(shows)
  // ✅ Group shows by date (same logic, optimized)
  const groupedDateTime = useMemo(() => {
    const grouped = shows.reduce((acc, s) => {
      const dateKey = new Date(s.startTime).toISOString().split("T")[0];
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(s);
      return acc;
    }, {});
    return grouped;
  }, [shows]);

  // ✅ Related movies
  const { data: relatedMovies = [] } = useQuery({
    queryKey: ["relatedMovies", id],
    queryFn: () => fetchRelatedMovies(id),
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
  });

  // ✅ Favourite status
  const { data: isFav = false, isLoading: favStatusLoading } = useQuery({
    queryKey: ["favouriteStatus", id],
    queryFn: () => fetchFavouriteStatus(id),
    enabled: !!id,
    staleTime: 10 * 1000,
  });

  // ✅ Toggle favourite mutation
  const toggleFavMutation = useMutation({
    mutationFn: async () => {
      if (isFav) {
        return api.delete(`/favourites/${id}`);
      } else {
        return api.post(`/favourites`, { movieId: id });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["favouriteStatus", id]);
      queryClient.invalidateQueries(["favourites"]); // for Favourite page list

      toast.success(isFav ? "Removed from favourites" : "Added to favourites ❤️");
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || "Favourite failed");
    },
  });

  const loading = movieLoading || showsLoading;
  if (loading) return <Loading />;
  if (!movie) return <Loading />;

  return (
    <div className="px-16 md:px-16 lg:px-40 pt-30 md:pt-50">
      <div className="flex flex-col md:flex-row gap-8 max-w-61xl mx-auto">
        <img
          src={movie.posterPath}
          alt=""
          className="max-md:mx-auto rounded-x1 h-104 max-w-70 object-cover"
        />

        <div className="relative flex flex-col gap-3">
          <BlurCircle top="-100px" left="-100px" />
          <p className="text-primary">{movie.originalLanguage}</p>

          <h1 className="text-4x1 font-semibold max-w-96 text-balance">
            {movie.title}
          </h1>

          <div className="flex items-center gap-2 text-gray-300 ">
            <StarIcon className="w-5 h-5 text-primary full-primary" />
            {movie.voteAverage?.toFixed(1)} user Rating
          </div>

          <p className="text-gray-400 mt-2 text-sm leading-tight max-w-xl">
            {movie.overview}
          </p>

          <p>
            {timeFormat(movie.runtime)} ·{" "}
            {movie.genres?.map((genre) => genre.name).join(" ,")} ·{" "}
            {movie.releaseDate?.split("T")[0]}
          </p>

          <div className="flex items-center flex-wrap gap-4 mt-4">
            <button
              className="flex items-center gap-2 px-7 py-3 text-sm bg-gray-800
              hover:bg-gray-900 transition rounded-md font-medium cursor-pointer active:scale-95"
             onClick={() => {
  const key = movie?.trailers?.[0]?.youtubeKey;
  if (!key) return toast.error("Trailer not available");
  window.open(`https://www.youtube.com/watch?v=${key}`, "_blank");
}}
            >
              <PlayCircleIcon className="w-5 h-5" />
              Watch Trailer
            </button>

            <a
              href="#dateSelect"
              className="px-10 py-3 text-sm bg-primary hover:bg-primary-dull transition rounded-md font-medium
              cursor-pointer active:scale-95"
            >
              Buy Tickets
            </a>

            {/* ✅ Favourite Button */}
            <button
              disabled={toggleFavMutation.isPending || favStatusLoading}
              onClick={() => toggleFavMutation.mutate()}
              className="bg-gray-700 p-2.5 rounded-full transition cursor-pointer active:scale-95"
            >
              <HeartIcon
                className={`w-5 h-5 ${
                  isFav ? "text-red-500 fill-red-500" : ""
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      <p className="text-lg font-medium mt-20">Your Favourite Cast</p>

      <div className="overflow-x-auto no-scrollbar mt-8 pb-4">
        <div className="flex items-center gap-4 w-max px-4">
          {movie.casts?.slice(0, 12).map((cast) => (
            <div key={cast.id} className="flex flex-col items-center text-center">
              <img
                src={cast.profilePath}
                alt=""
                className="rounded-full h-20 md:h-20 aspect-square object-cover"
              />
              <p className="font-medium text-xs mt-3">{cast.name}</p>
            </div>
          ))}
        </div>
      </div>
  {shows?.length > 0 ? (
  <DateSelect dateTime={groupedDateTime} id={id} />
) : (
  <div className="mt-4 max-w-xl flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
    <div className="h-9 w-9 rounded-full bg-red-500/20 flex items-center justify-center">
      <span className="text-red-300 text-lg">⚠️</span>
    </div>

    <div>
      <p className="text-sm font-semibold text-white">
        No shows available for this movie
      </p>
      <p className="text-xs text-gray-400 mt-1">
        Please check again later.
      </p>
    </div>
  </div>
)}
      <p className="text-lg font-medium mt-20 mb-8">You May Also Like</p>

      <div className="flex flex-wrap max-sm:justify-center gap-8">
        {relatedMovies.slice(0, 4).map((m) => (
          <Moviecard key={m.id} movie={m} />
        ))}
      </div>

      <div className="flex justify-center mt-20">
        <button
          onClick={() => {
            navigate("/movies");
            scrollTo(0, 0);
          }}
          className="px-10 py-3 text-sm bg-primary hover:bg-primary dull transition rounded-md font-medium cursor-pointer"
        >
          Show More
        </button>
      </div>
    </div>
  );
};

export default MovieDetails;
