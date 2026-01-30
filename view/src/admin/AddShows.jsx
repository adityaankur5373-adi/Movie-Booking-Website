import React, { useState, useEffect } from "react";
import Loading from "../components/Loading";
import Title from "../admincomponents/Title";
import { StarIcon, CheckIcon } from "lucide-react";
import { KConverter } from "../lib/KConverter";
import api from "../api/api";
import { toast } from "react-hot-toast";

const AddShows = () => {
  const currency = import.meta.env.VITE_CURRENCY;

  const [nowPlayingMovies, setNowPlayingMovies] = useState([]);
  const [selectedMovie, setSelectedMovie] = useState(null);

  const [theatres, setTheatres] = useState([]);
  const [theatreId, setTheatreId] = useState("");

  const [screens, setScreens] = useState([]);
  const [screenId, setScreenId] = useState("");

  const [dateTimeSelection, setDateTimeSelection] = useState({});
  const [dateTimeInput, setDateTimeInput] = useState("");

  const [showPrice, setShowPrice] = useState("");

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // ✅ Fetch now playing movies
  const fetchNowPlayingMovies = async () => {
    try {
      setLoading(true);

      const { data } = await api.get("/movies/now-playing");

      if (data?.success) {
        setNowPlayingMovies(data.movies || []);
      } else {
        toast.error(data?.message || "Failed to fetch movies");
      }
    } catch (error) {
      console.log(error);
      toast.error("Server error while fetching movies");
    } finally {
      setLoading(false);
    }
  };

  // ✅ Fetch theatres
  const fetchTheatres = async () => {
    try {
      const { data } = await api.get("/threater");

      if (data?.success) {
        setTheatres(data.theatres || []);
      } else {
        toast.error(data?.message || "Failed to fetch theatres");
      }
    } catch (error) {
      console.log(error);
      toast.error("Server error while fetching theatres");
    }
  };

  // ✅ Fetch screens by theatreId (from theatre.screenList)
  const fetchScreensByTheatre = async (tId) => {
    if (!tId) return;

    try {
      const { data } = await api.get(`/threater/${tId}`);

      if (data?.success) {
        setScreens(data?.theatre?.screenList || []);
      } else {
        toast.error(data?.message || "Failed to fetch screens");
      }
    } catch (error) {
      console.log(error);
      toast.error("Server error while fetching screens");
    }
  };

  // when theatre changes → reset screen + fetch screens
  useEffect(() => {
    if (theatreId) {
      setScreenId("");
      setScreens([]);
      fetchScreensByTheatre(theatreId);
    } else {
      setScreenId("");
      setScreens([]);
    }
  }, [theatreId]);

  const handleDateTimeAdd = () => {
    if (!dateTimeInput) return;

    const [date, time] = dateTimeInput.split("T");
    if (!date || !time) return;

    setDateTimeSelection((prev) => {
      const times = prev[date] || [];
      if (!times.includes(time)) return { ...prev, [date]: [...times, time] };
      return prev;
    });

    setDateTimeInput("");
  };

  const handleRemoveTime = (date, time) => {
    setDateTimeSelection((prev) => {
      const filteredTimes = prev[date].filter((t) => t !== time);

      if (filteredTimes.length === 0) {
        const { [date]: _, ...rest } = prev;
        return rest;
      }

      return {
        ...prev,
        [date]: filteredTimes,
      };
    });
  };

  // ✅ Create multiple shows (Option A)
  const handleAddShow = async () => {
    if (!selectedMovie) return toast.error("Please select a movie");
    if (!theatreId) return toast.error("Please select a theatre");
    if (!screenId) return toast.error("Please select a screen");

    if (!showPrice || Number(showPrice) <= 0)
      return toast.error("Please enter valid price");

    if (Object.keys(dateTimeSelection).length === 0)
      return toast.error("Please add date & time");

    try {
      setSubmitting(true);

      const startTimes = [];
      for (const date of Object.keys(dateTimeSelection)) {
        for (const time of dateTimeSelection[date]) {
          startTimes.push(`${date}T${time}`);
        }
      }

      const requests = startTimes.map((startTime) =>
        api.post("/shows", {
          movieId: selectedMovie,
          screenId,
          startTime,
          seatPrice: Number(showPrice),
        })
      );

      await Promise.all(requests);

      toast.success("All shows created successfully ✅");

      // reset
      setSelectedMovie(null);
      setTheatreId("");
      setScreenId("");
      setShowPrice("");
      setDateTimeSelection({});
      setDateTimeInput("");
    } catch (error) {
      console.log(error);
      toast.error(error?.response?.data?.message || "Failed to create shows");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    fetchNowPlayingMovies();
    fetchTheatres();
  }, []);

  if (loading) return <Loading />;

  const selectedMovieData = nowPlayingMovies.find((m) => m.id === selectedMovie);

  return nowPlayingMovies.length > 0 ? (
    <>
      <Title text1="Add" text2="Shows" />

      {/* Movies List */}
      <p className="mt-10 text-lg font-medium">Now Playing Movies</p>

      <div className="overflow-x-auto pb-4">
        <div className="group flex flex-wrap gap-4 mt-4 w-max">
          {nowPlayingMovies.map((movie) => (
            <div
              onClick={() => setSelectedMovie(movie.id)}
              key={movie.id}
              className={`relative w-40 cursor-pointer group-hover:not-hover:opacity-40 hover:-translate-y-1 transition duration-300`}
            >
              <div className="relative rounded-lg overflow-hidden">
                <img
                  src={movie.posterPath}
                  alt={movie.title}
                  className="w-full h-56 object-cover brightness-90"
                />

                <div className="text-sm flex items-center justify-between p-2 bg-black/70 w-full absolute bottom-0 left-0">
                  <p className="flex items-center gap-1 text-gray-300">
                    <StarIcon className="w-4 h-4 text-primary fill-primary" />
                    {movie.voteAverage?.toFixed(1)}
                  </p>
                  <p className="text-gray-300">
                    {KConverter(movie.voteCount)} Votes
                  </p>
                </div>
              </div>

              {selectedMovie === movie.id && (
                <div className="absolute top-2 right-2 flex items-center justify-center bg-primary h-6 w-6 rounded">
                  <CheckIcon className="w-4 h-4 text-white" strokeWidth={2.5} />
                </div>
              )}

              <p className="font-medium truncate mt-1">{movie.title}</p>
              <p className="text-gray-400 text-sm">{movie.release_date}</p>
            </div>
          ))}
        </div>
      </div>

      

      {/* Theatre Dropdown */}
      <div className="mt-8">
        <label className="block text-sm font-medium mb-2">Select Theatre</label>

        <select
          value={theatreId}
          onChange={(e) => setTheatreId(e.target.value)}
          className="border border-gray-600 bg-gray-900 text-white px-3 py-2 rounded-md outline-none"
        >
          <option value="" className="bg-gray-900 text-white">
            -- Select Theatre --
          </option>

          {theatres.map((theatre) => (
            <option
              key={theatre.id}
              value={theatre.id}
              className="bg-gray-900 text-white"
            >
              {theatre.name} ({theatre.city})
            </option>
          ))}
        </select>
      </div>

      {/* Screen Dropdown */}
      <div className="mt-6">
        <label className="block text-sm font-medium mb-2">
          Select Screen {screens.length > 0 ? `(${screens.length})` : ""}
        </label>

        <select
          value={screenId}
          onChange={(e) => setScreenId(e.target.value)}
          disabled={!theatreId}
          className="border border-gray-600 bg-gray-900 text-white px-3 py-2 rounded-md outline-none disabled:opacity-60"
        >
          <option value="" className="bg-gray-900 text-white">
            -- Select Screen --
          </option>

          {screens.map((screen) => (
            <option
              key={screen.id}
              value={screen.id}
              className="bg-gray-900 text-white"
            >
              {screen.name}
            </option>
          ))}
        </select>

        {!theatreId && (
          <p className="text-xs text-gray-400 mt-1">
            Select a theatre first to load screens.
          </p>
        )}
      </div>

      {/* Show Price */}
      <div className="mt-6">
        <label className="block text-sm font-medium mb-2">Show Price</label>

        <div className="inline-flex items-center gap-2 border border-gray-600 px-3 py-2 rounded-md">
          <p className="text-gray-400 text-sm">{currency}</p>
          <input
            min={0}
            type="number"
            value={showPrice}
            onChange={(e) => setShowPrice(e.target.value)}
            placeholder="Enter show price"
            className="outline-none bg-transparent text-white"
          />
        </div>
      </div>

      {/* DateTime */}
      <div className="mt-6">
        <label className="block text-sm font-medium mb-2">
          Select Date and Time
        </label>

        <div className="inline-flex gap-5 border border-gray-600 p-1 pl-3 rounded-lg">
          <input
            type="datetime-local"
            value={dateTimeInput}
            onChange={(e) => setDateTimeInput(e.target.value)}
            className="outline-none rounded-md bg-gray-900 text-white px-2"
          />

          <button
            onClick={handleDateTimeAdd}
            className="bg-primary/80 text-white px-3 py-2 text-sm rounded-lg hover:bg-primary cursor-pointer"
          >
            Add Time
          </button>
        </div>
      </div>

      {/* Selected Times */}
      {Object.keys(dateTimeSelection).length > 0 && (
        <div className="mt-6">
          <p className="text-sm font-medium mb-2">Selected Times</p>

          <div className="space-y-3">
            {Object.entries(dateTimeSelection).map(([date, times]) => (
              <div key={date} className="p-2">
                <p className="text-gray-300 font-medium mb-2">{date}</p>

                <div className="flex flex-wrap gap-2">
                  {times.map((time) => (
                    <div
                      key={time}
                      className="flex items-center gap-2 bg-gray-800 px-3 py-1 rounded-full text-sm"
                    >
                      <span className="text-gray-200">{time}</span>

                      <button
                        onClick={() => handleRemoveTime(date, time)}
                        className="text-red-400 hover:text-red-500 text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Submit */}
      <button
        disabled={submitting}
        onClick={handleAddShow}
        className="bg-primary text-white px-8 py-2 mt-6 rounded hover:bg-primary/90 transition-all cursor-pointer disabled:opacity-60"
      >
        {submitting ? "Adding..." : "Add Show"}
      </button>
    </>
  ) : (
    <p className="mt-10 text-gray-400">No movies found</p>
  );
};

export default AddShows;
