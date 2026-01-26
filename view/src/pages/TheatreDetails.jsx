import React, { useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import BlurCircle from "../components/BlurCircle";
import { MapPinIcon, FilmIcon } from "lucide-react";
import { toast } from "react-hot-toast";
import TheatreMovieCard from "../components/TheatreMovieCard";
import Loading from "../components/Loading";
import api from "../api/api";
import { useQuery } from "@tanstack/react-query";

const isPastShow = (iso) => new Date(iso).getTime() < Date.now();

const fetchTheatre = async (theatreId) => {
  const { data } = await api.get(`/theatres/${theatreId}`);
  if (!data?.success) throw new Error("Theatre not found");
  return data.theatre;
};

const fetchTheatreShows = async (theatreId) => {
  const { data } = await api.get(`/shows/theatre/${theatreId}`);
  if (!data?.success) return [];
  return data.shows || [];
};

const TheatreDetails = () => {
  const { theatreId } = useParams();
  const navigate = useNavigate();

  // ✅ theatre info
  const {
    data: theatre,
    isLoading: theatreLoading,
    isError: theatreError,
  } = useQuery({
    queryKey: ["theatre", theatreId],
    queryFn: () => fetchTheatre(theatreId),
    enabled: !!theatreId,
    staleTime: 5 * 60 * 1000,
  });

  // ✅ shows running in this theatre (today only)
  const {
    data: theatreShows = [],
    isLoading: showsLoading,
    isError: showsError,
  } = useQuery({
    queryKey: ["theatreShows", theatreId],
    queryFn: () => fetchTheatreShows(theatreId),
    enabled: !!theatreId,
    staleTime: 30 * 1000,
  });

  // ✅ Group shows by movieId (same as your old logic)
  const moviesWithShows = useMemo(() => {
    const grouped = theatreShows.reduce((acc, show) => {
      const movieId = show?.movie?.id;
      if (!movieId) return acc;

      if (!acc[movieId]) acc[movieId] = [];
      acc[movieId].push({
        movieId,
        showId: show.id,
        screenId: show.screen?.id,
        screenName: show.screen?.name,
        time: show.startTime,
        isPast: isPastShow(show.startTime),
      });

      return acc;
    }, {});

    return Object.keys(grouped).map((movieId) => ({
      movie: theatreShows.find((s) => s?.movie?.id === movieId)?.movie,
      shows: grouped[movieId].sort((a, b) => new Date(a.time) - new Date(b.time)),
    }));
  }, [theatreShows]);

  const handleSelectShow = (showId, time) => {
    if (!showId) return toast.error("Show not found");

    if (isPastShow(time)) {
      return toast.error("This showtime has already passed");
    }

    navigate(`/shows/${showId}/seats`);
  };

  const loading = theatreLoading || showsLoading;

  if (loading) return <Loading />;

  if (theatreError || showsError || !theatre) {
    return <Loading />;
  }

  return (
    <div className="relative my-40 mb-60 px-6 md:px-16 lg:px-40 xl:px-44 overflow-hidden min-h-[80vh]">
      <BlurCircle top="150px" left="0px" />
      <BlurCircle bottom="150px" right="0px" />

      {/* Theatre Header */}
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl md:text-3xl font-semibold">{theatre.name}</h1>

        <div className="space-y-2 text-sm text-gray-300">
          <p className="flex items-center gap-2">
            <MapPinIcon className="w-4 h-4 text-primary" />
            {theatre.area ? `${theatre.area}, ` : ""}
            {theatre.city}
          </p>

          <p className="flex items-center gap-2">
            <FilmIcon className="w-4 h-4 text-primary" />
            {theatre?._count?.screenList ?? 0} Screens
          </p>

          <p className="text-xs text-gray-400">
            {theatre.address || "Address not available"}
          </p>
        </div>

        <p className="mt-2 text-gray-400 text-sm">
          Select a movie showtime to continue booking.
        </p>
      </div>

      {/* Movies Running */}
      <h2 className="text-lg font-medium mt-14 mb-6">Now Running</h2>

      {moviesWithShows.length === 0 ? (
        <p className="text-gray-400 text-sm">
          No shows available in this theatre.
        </p>
      ) : (
        <div className="flex flex-wrap max-sm:justify-center gap-8">
          {moviesWithShows.map((item, idx) => {
            if (!item.movie) return null;

            return (
              <TheatreMovieCard
                key={idx}
                movie={item.movie}
                shows={item.shows}
                onSelectShow={(showId, time) => handleSelectShow(showId, time)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};
export default TheatreDetails;
