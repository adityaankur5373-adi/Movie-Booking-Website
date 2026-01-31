import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import BlurCircle from "../components/BlurCircle";
import Loading from "../components/Loading";
import { ClockIcon, MapPinIcon, FilmIcon } from "lucide-react";
import isoTimeFormat from "../lib/isoTimeFormat";
import { toast } from "react-hot-toast";
import api from "../api/api";

const MovieTheatres = () => {
  const { movieId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const selectedDate = searchParams.get("date"); // YYYY-MM-DD

  const [movie, setMovie] = useState(null);
  const [shows, setShows] = useState([]);
  const [loading, setLoading] = useState(true);

  // ========================
  // Fetch Movie + Shows
  // ========================
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // 1️⃣ Movie details
        const movieRes = await api.get(`/movies/${movieId}`);
        if (movieRes.data?.success) {
          setMovie(movieRes.data.movie);
        } else {
          setMovie(null);
        }

        // 2️⃣ Shows by movie + date
        if (!selectedDate) {
          setShows([]);
          setLoading(false);
          return;
        }

        const showRes = await api.get(`/shows`, {
          params: { movieId, date: selectedDate },
        });

        if (showRes.data?.success) {
          setShows(showRes.data.shows || []);
        } else {
          setShows([]);
        }
      } catch (err) {
        console.log("Error:", err?.response?.data || err.message);
        toast.error("Failed to load shows");
        setShows([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [movieId, selectedDate]);

  // ========================
  // Group shows by theatre
  // ========================
  const theatresWithShows = useMemo(() => {
    const grouped = shows.reduce((acc, s) => {
      const theatre = s?.screen?.theatre;

      if (!theatre) return acc;

      const theatreId = theatre.id;

      if (!acc[theatreId]) {
        acc[theatreId] = {
          theatre,
          shows: [],
        };
      }

      // ✅ push FULL backend object (NO reshaping)
      acc[theatreId].shows.push(s);

      return acc;
    }, {});

    // convert object → array & sort by time
    return Object.values(grouped).map((t) => ({
      ...t,
      shows: t.shows.sort(
        (a, b) => new Date(a.startTime) - new Date(b.startTime)
      ),
    }));
  }, [shows]);

  const handleSelectShow = (showId) => {
    if (!showId) return toast.error("Show not found");
    navigate(`/shows/${showId}/seats`);
  };

  if (loading) return <Loading />;
  if (!movie) return <Loading />;

  return (
    <div className="relative my-40 mb-60 px-6 md:px-16 lg:px-40 xl:px-44 overflow-hidden min-h-[80vh]">
      <BlurCircle top="150px" left="0px" />
      <BlurCircle bottom="150px" right="0px" />

      {/* ================= Movie Header ================= */}
      <div className="flex flex-col md:flex-row gap-6 items-start">
        <img
          src={movie.posterPath || movie.poster_path}
          alt={movie.title}
          className="w-[130px] h-[180px] object-cover rounded-xl border border-white/10"
        />

        <div className="flex-1">
          <h1 className="text-2xl md:text-3xl font-semibold">
            {movie.title}
          </h1>

          <p className="text-sm text-gray-400 mt-2 line-clamp-2">
            {movie.overview}
          </p>

          <p className="text-xs text-gray-400 mt-3">
            {selectedDate
              ? `Showing for: ${selectedDate}`
              : "Select a date to filter shows"}
          </p>
        </div>
      </div>

      {/* ================= Theatre List ================= */}
      <h2 className="text-lg font-medium mt-14 mb-6">
        Select Theatre & Time
      </h2>

      {!selectedDate ? (
        <p className="text-gray-400 text-sm">
          Please select a date first.
        </p>
      ) : theatresWithShows.length === 0 ? (
        <p className="text-gray-400 text-sm">
          No theatres available for this movie on the selected date.
        </p>
      ) : (
        <div className="space-y-6">
          {theatresWithShows.map((item) => (
            <div
              key={item.theatre.id}
              className="rounded-xl border border-white/10 bg-white/5 backdrop-blur p-5"
            >
              {/* Theatre Info */}
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h3 className="text-base font-semibold">
                    {item.theatre.name}
                  </h3>

                  <div className="mt-2 space-y-1 text-sm text-gray-300">
                    <p className="flex items-center gap-2">
                      <MapPinIcon className="w-4 h-4 text-primary" />
                      {item.theatre.area}, {item.theatre.city}
                    </p>

                    <p className="flex items-center gap-2">
                      <FilmIcon className="w-4 h-4 text-primary" />
                      {item.theatre.screenList?.length
                        ? `${item.theatre.screenList.length} Screens`
                        : "Screens Available"}
                    </p>
                  </div>
                </div>

                {/* Show Times */}
                <div className="flex flex-wrap gap-3">
                  {item.shows.map((s) => (
                    <button
                      key={s.id}
                      disabled={!s.isBookable}
                      onClick={() => {
                        if (!s.isBookable) return;
                        handleSelectShow(s.id);
                        scrollTo(0, 0);
                      }}
                      className={`flex items-center gap-2 px-4 py-2 text-sm rounded-full 
                        border transition active:scale-95
                        ${
                          !s.isBookable
                            ? "border-white/10 text-gray-500 bg-black/30 cursor-not-allowed"
                            : "border-white/30 text-white hover:bg-white hover:text-black cursor-pointer"
                        }`}
                    >
                      <ClockIcon className="w-4 h-4" />
                      {isoTimeFormat(s.startTime)}
                      <span className="text-xs opacity-70">
  ({s?.screen?.name || "Screen"})
</span>
                  <span className="text-xs opacity-60">
  {s.hasStarted ? "(Running)" : ""}
</span>

                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MovieTheatres;