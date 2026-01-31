import React, { useMemo, useState } from "react";
import BlurCircle from "./BlurCircle";
import ReactPlayer from "react-player";
import { PlayCircleIcon } from "lucide-react";
import api from "../api/api";
import { useQuery } from "@tanstack/react-query";

const toEmbedUrl = (url) => {
  if (!url) return null;

  if (url.includes("youtube.com/watch?v=")) {
    const id = url.split("v=")[1]?.split("&")[0];
    return `https://www.youtube.com/embed/${id}`;
  }

  if (url.includes("youtu.be/")) {
    const id = url.split("youtu.be/")[1]?.split("?")[0];
    return `https://www.youtube.com/embed/${id}`;
  }

  return url;
};

const fetchFeaturedTrailers = async () => {
  const { data } = await api.get("/movies/featured", {
    params: { limit: 4 },
  });

  if (!data?.success) return [];

  const allTrailers =
    (data.movies || []).flatMap((m) =>
      (m.trailers || []).map((t) => ({
        ...t,
        movieTitle: m.title,
        posterPath: m.posterPath,
      }))
    ) || [];

  return allTrailers;
};

const TrailerSection = () => {
  const [currentTrailer, setCurrentTrailer] = useState(null);

  const {
    data: trailers = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["featured-trailers", 4],
    queryFn: fetchFeaturedTrailers,
    staleTime: 1000 * 60 * 10, // 10 min cache (fast UI)
    retry: 1,
    onSuccess: (data) => {
      if (!currentTrailer && data?.length > 0) {
        setCurrentTrailer(data[0]);
      }
    },
  });

  const embedUrl = useMemo(
    () => toEmbedUrl(currentTrailer?.videoUrl),
    [currentTrailer]
  );

  return (
    <div className="px-6 md:px-16 lg:px-24 xl:px-44 py-20 overflow-hidden">
      <p className="text-gray-300 font-medium text-lg max-w-240 mx-auto">
        Trailers
      </p>

      <div className="relative mt-6">
        <BlurCircle top="-100px" right="-100px" />

        {/* Loading State */}
        {isLoading && (
          <div className="w-full max-w-3xl mx-auto h-[300px] flex items-center justify-center bg-gray-900 rounded-xl border border-gray-700 text-gray-400">
            Loading trailers...
          </div>
        )}

        {/* Error State */}
        {isError && (
          <div className="w-full max-w-3xl mx-auto h-[300px] flex items-center justify-center bg-gray-900 rounded-xl border border-gray-700 text-red-400">
            {error?.response?.data?.message || error?.message || "Something went wrong"}
          </div>
        )}

        {/* Player */}
        {!isLoading && !isError && (
          <>
            {embedUrl ? (
              <ReactPlayer
                src={embedUrl} // ✅ ReactPlayer uses "url" not "src"
                controls={true}
                className="mx-auto max-w-full"
                width="960px"
                height="540px"
              />
            ) : (
              <div className="w-full max-w-3xl mx-auto h-[300px] flex items-center justify-center bg-gray-900 rounded-xl border border-gray-700 text-gray-400">
                Trailer not available
              </div>
            )}

            {currentTrailer?.videoUrl && (
              <a
                href={currentTrailer.videoUrl}
                target="_blank"
                rel="noreferrer"
                className="block text-center mt-4 text-primary underline"
              >
                Watch on YouTube
              </a>
            )}
          </>
        )}
      </div>

      {/* Thumbnails */}
      <div className="group grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8 mt-8 max-w-3xl mx-auto">
        {trailers.map((t) => (
          <div
            key={t.id}
            className="relative group-hover:not-hover:opacity-50 hover:-translate-y-1 duration-300 transition cursor-pointer"
            onClick={() => setCurrentTrailer(t)}
          >
            <img
              src={t.image}
              alt="trailer"
              className="rounded-lg w-full h-40 md:h-44 object-cover brightness-75"
            />

            <PlayCircleIcon
              strokeWidth={1.6}
              className="absolute inset-0 m-auto w-8 h-8 md:w-10 md:h-10 text-white"
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default TrailerSection;