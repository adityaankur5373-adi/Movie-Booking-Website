import { useState } from "react";
import { toast } from "react-hot-toast";
import Title from "../admincomponents/Title";
import BlurCircle from "../components/BlurCircle";
import api from "../api/api";
import Loading from "../components/Loading";
import { PlusIcon, Trash2Icon, SearchIcon } from "lucide-react";
import omdbApi from "../api/movieapi";
const CreateMovie = () => {
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);

  const OMDB_KEY = import.meta.env.VITE_OMDB_KEY;

  const [form, setForm] = useState({
    imdbId: "",
    title: "",
    overview: "",
    posterPath: "",
    backdropPath: "",
    releaseDate: "",
    runtime: "",
    originalLanguage: "",
    tagline: "",
    voteAverage: "",
    voteCount: "",
  });

  // ✅ Only genre name (no id)
  const [genres, setGenres] = useState([{ name: "" }]);

  // Cast
  const [casts, setCasts] = useState([{ name: "", profilePath: "" }]);

  // Trailers
  const [trailers, setTrailers] = useState([{ image: "", videoUrl: "" }]);

  const handleChange = (e) => {
    setForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  // =========================
  // GENRES HANDLERS
  // =========================
  const updateGenre = (index, value) => {
    setGenres((prev) => {
      const copy = [...prev];
      copy[index].name = value;
      return copy;
    });
  };

  const addGenre = () => setGenres((prev) => [...prev, { name: "" }]);

  const removeGenre = (index) => {
    setGenres((prev) => prev.filter((_, i) => i !== index));
  };

  // =========================
  // CAST HANDLERS
  // =========================
  const updateCast = (index, key, value) => {
    setCasts((prev) => {
      const copy = [...prev];
      copy[index][key] = value;
      return copy;
    });
  };

  const addCast = () =>
    setCasts((prev) => [...prev, { name: "", profilePath: "" }]);

  const removeCast = (index) => {
    setCasts((prev) => prev.filter((_, i) => i !== index));
  };

  // =========================
  // TRAILER HANDLERS
  // =========================
  const updateTrailer = (index, key, value) => {
    setTrailers((prev) => {
      const copy = [...prev];
      copy[index][key] = value;
      return copy;
    });
  };

  const addTrailer = () =>
    setTrailers((prev) => [...prev, { image: "", videoUrl: "" }]);

  const removeTrailer = (index) => {
    setTrailers((prev) => prev.filter((_, i) => i !== index));
  };

  // =========================
  // OMDb FETCH (Auto-fill)
  // =========================
  const fetchFromOMDb = async () => {
    if (!OMDB_KEY) {
      toast.error("OMDb API key missing in VITE_OMDB_KEY");
      return;
    }

    if (!form.imdbId.trim()) {
      toast.error("Enter IMDb ID first (example: tt13751694)");
      return;
    }

    try {
      setFetching(true);

      const imdbId = form.imdbId.trim();

      const { data } = await omdbApi.get("/", {
  params: {
    i: imdbId,
    apikey: OMDB_KEY,
    plot: "full",
  },
});


      if (data.Response === "False") {
        toast.error(data.Error || "Movie not found in OMDb");
        return;
      }

      // OMDb gives: Title, Plot, Poster, Released, Runtime, Language, imdbRating, imdbVotes, Genre, Actors
      const releaseDate = data.Released && data.Released !== "N/A"
        ? new Date(data.Released).toISOString().slice(0, 10) // yyyy-mm-dd
        : "";

      const runtime =
        data.Runtime && data.Runtime !== "N/A"
          ? Number(data.Runtime.replace(" min", ""))
          : "";

      const voteAverage =
        data.imdbRating && data.imdbRating !== "N/A"
          ? Number(data.imdbRating)
          : "";

      const voteCount =
        data.imdbVotes && data.imdbVotes !== "N/A"
          ? Number(data.imdbVotes.replaceAll(",", ""))
          : "";

      setForm((prev) => ({
        ...prev,
        title: data.Title !== "N/A" ? data.Title : prev.title,
        overview: data.Plot !== "N/A" ? data.Plot : prev.overview,
        posterPath: data.Poster !== "N/A" ? data.Poster : prev.posterPath,
        releaseDate,
        runtime,
        originalLanguage: data.Language !== "N/A" ? data.Language : prev.originalLanguage,
        voteAverage,
        voteCount,
      }));

      // Auto-fill genres from OMDb
      if (data.Genre && data.Genre !== "N/A") {
        const gArr = data.Genre.split(",").map((g) => g.trim());
        setGenres(gArr.length ? gArr.map((name) => ({ name })) : [{ name: "" }]);
      }

      // Auto-fill casts from OMDb (only names, no images)
      if (data.Actors && data.Actors !== "N/A") {
        const cArr = data.Actors.split(",").map((a) => a.trim());
        setCasts(
          cArr.length
            ? cArr.map((name) => ({ name, profilePath: "" }))
            : [{ name: "", profilePath: "" }]
        );
      }

      toast.success("Auto-filled from IMDb (OMDb) ✅");
    } catch (err) {
      console.log("OMDb fetch error:", err);
      toast.error("Failed to fetch from OMDb");
    } finally {
      setFetching(false);
    }
  };

  const validate = () => {
    if (!form.title.trim()) return "Title is required";
    return null;
  };

  const resetAll = () => {
    setForm({
      imdbId: "",
      title: "",
      overview: "",
      posterPath: "",
      backdropPath: "",
      releaseDate: "",
      runtime: "",
      originalLanguage: "",
      tagline: "",
      voteAverage: "",
      voteCount: "",
    });

    setGenres([{ name: "" }]);
    setCasts([{ name: "", profilePath: "" }]);
    setTrailers([{ image: "", videoUrl: "" }]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const error = validate();
    if (error) return toast.error(error);

    try {
      setLoading(true);

      const cleanGenres = genres
        .map((g) => g.name.trim())
        .filter(Boolean)
        .map((name) => ({ name }));

      const cleanCasts = casts
        .filter((c) => c.name.trim())
        .map((c) => ({
          name: c.name.trim(),
          profilePath: c.profilePath?.trim() || null,
        }));

      const cleanTrailers = trailers
        .filter((t) => t.videoUrl.trim())
        .map((t) => ({
          image: t.image?.trim() || null,
          videoUrl: t.videoUrl.trim(),
        }));

      const payload = {
        imdbId: form.imdbId.trim() || null,
        title: form.title.trim(),
        overview: form.overview || null,
        posterPath: form.posterPath || null,
        backdropPath: form.backdropPath || null,
        releaseDate: form.releaseDate || null, // yyyy-mm-dd
        runtime: form.runtime ? Number(form.runtime) : null,
        originalLanguage: form.originalLanguage || null,
        tagline: form.tagline || null,
        voteAverage: form.voteAverage ? Number(form.voteAverage) : null,
        voteCount: form.voteCount ? Number(form.voteCount) : null,

        genres: cleanGenres,
        casts: cleanCasts,
        trailers: cleanTrailers,
      };

      const { data } = await api.post("/movies", payload);

      if (data?.success) {
        toast.success("Movie created successfully ✅");
        resetAll();
      } else {
        toast.error("Failed to create movie");
      }
    } catch (err) {
      console.log("CreateMovie error:", err?.response?.data || err.message);
      toast.error(err?.response?.data?.message || "Movie create failed");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Loading />;

  return (
    <div className="relative px-6 md:px-16 lg:px-40 pt-28 md:pt-36 pb-24 overflow-hidden min-h-[80vh]">
      <BlurCircle top="-100px" left="-80px" />
      <BlurCircle bottom="0px" right="0px" />

      <Title text1="Create" text2="Movie" />

      <form
        onSubmit={handleSubmit}
        className="mt-8 max-w-3xl rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-6"
      >
        {/* IMDb ID + Fetch */}
        <div className="mb-4">
          <label className="text-sm text-gray-300">IMDb ID (optional)</label>

          <div className="mt-2 flex gap-3">
            <input
              name="imdbId"
              value={form.imdbId}
              onChange={handleChange}
              placeholder="tt13751694"
              className="w-full px-4 py-3 rounded-xl bg-gray-900/40 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-primary"
            />

            <button
              type="button"
              onClick={fetchFromOMDb}
              disabled={fetching}
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-gray-800 hover:bg-gray-900 transition font-medium disabled:opacity-50"
            >
              <SearchIcon className="w-4 h-4" />
              {fetching ? "Fetching..." : "Auto Fill"}
            </button>
          </div>
        </div>

        {/* Title */}
        <div className="mb-4">
          <label className="text-sm text-gray-300">Movie Title *</label>
          <input
            name="title"
            value={form.title}
            onChange={handleChange}
            placeholder="Enter movie title"
            className="mt-2 w-full px-4 py-3 rounded-xl bg-gray-900/40 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-primary"
          />
        </div>

        {/* Overview */}
        <div className="mb-4">
          <label className="text-sm text-gray-300">Overview</label>
          <textarea
            name="overview"
            value={form.overview}
            onChange={handleChange}
            placeholder="Movie description"
            rows={4}
            className="mt-2 w-full px-4 py-3 rounded-xl bg-gray-900/40 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-primary"
          />
        </div>

        {/* Poster + Backdrop */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-sm text-gray-300">Poster URL</label>
            <input
              name="posterPath"
              value={form.posterPath}
              onChange={handleChange}
              placeholder="https://..."
              className="mt-2 w-full px-4 py-3 rounded-xl bg-gray-900/40 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="text-sm text-gray-300">Backdrop URL</label>
            <input
              name="backdropPath"
              value={form.backdropPath}
              onChange={handleChange}
              placeholder="https://..."
              className="mt-2 w-full px-4 py-3 rounded-xl bg-gray-900/40 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        {/* Release date + runtime */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-sm text-gray-300">Release Date</label>
            <input
              type="date"
              name="releaseDate"
              value={form.releaseDate}
              onChange={handleChange}
              className="mt-2 w-full px-4 py-3 rounded-xl bg-gray-900/40 border border-white/10 text-white focus:outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="text-sm text-gray-300">Runtime (minutes)</label>
            <input
              type="number"
              name="runtime"
              value={form.runtime}
              onChange={handleChange}
              placeholder="120"
              className="mt-2 w-full px-4 py-3 rounded-xl bg-gray-900/40 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        {/* Language + Tagline */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-sm text-gray-300">
              Original Language (comma separated)
            </label>
            <input
              name="originalLanguage"
              value={form.originalLanguage}
              onChange={handleChange}
              placeholder="Hindi, English"
              className="mt-2 w-full px-4 py-3 rounded-xl bg-gray-900/40 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="text-sm text-gray-300">Tagline</label>
            <input
              name="tagline"
              value={form.tagline}
              onChange={handleChange}
              placeholder="Movie tagline"
              className="mt-2 w-full px-4 py-3 rounded-xl bg-gray-900/40 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        {/* Rating + Votes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="text-sm text-gray-300">Vote Average</label>
            <input
              type="number"
              step="0.1"
              name="voteAverage"
              value={form.voteAverage}
              onChange={handleChange}
              placeholder="8.5"
              className="mt-2 w-full px-4 py-3 rounded-xl bg-gray-900/40 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="text-sm text-gray-300">Vote Count</label>
            <input
              type="number"
              name="voteCount"
              value={form.voteCount}
              onChange={handleChange}
              placeholder="1000"
              className="mt-2 w-full px-4 py-3 rounded-xl bg-gray-900/40 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        {/* =========================
            GENRES SECTION (NO ID)
        ========================= */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-gray-200">Genres</p>

            <button
              type="button"
              onClick={addGenre}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-gray-800 hover:bg-gray-900 transition text-sm"
            >
              <PlusIcon className="w-4 h-4" />
              Add Genre
            </button>
          </div>

          <div className="space-y-3">
            {genres.map((g, index) => (
              <div
                key={index}
                className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-white/5 border border-white/10 rounded-xl p-4"
              >
                <input
                  placeholder="Genre Name (eg: Action)"
                  value={g.name}
                  onChange={(e) => updateGenre(index, e.target.value)}
                  className="md:col-span-2 px-4 py-3 rounded-xl bg-gray-900/40 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-primary"
                />

                <button
                  type="button"
                  onClick={() => removeGenre(index)}
                  disabled={genres.length === 1}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gray-800 hover:bg-gray-900 transition text-sm disabled:opacity-40"
                >
                  <Trash2Icon className="w-4 h-4" />
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* =========================
            CAST SECTION
        ========================= */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-gray-200">Cast</p>

            <button
              type="button"
              onClick={addCast}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-gray-800 hover:bg-gray-900 transition text-sm"
            >
              <PlusIcon className="w-4 h-4" />
              Add Cast
            </button>
          </div>

          <div className="space-y-3">
            {casts.map((c, index) => (
              <div
                key={index}
                className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-white/5 border border-white/10 rounded-xl p-4"
              >
                <input
                  placeholder="Actor Name (eg: Ranbir Kapoor)"
                  value={c.name}
                  onChange={(e) => updateCast(index, "name", e.target.value)}
                  className="px-4 py-3 rounded-xl bg-gray-900/40 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-primary"
                />

                <input
                  placeholder="Profile Image URL (optional)"
                  value={c.profilePath}
                  onChange={(e) =>
                    updateCast(index, "profilePath", e.target.value)
                  }
                  className="px-4 py-3 rounded-xl bg-gray-900/40 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-primary"
                />

                <button
                  type="button"
                  onClick={() => removeCast(index)}
                  disabled={casts.length === 1}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gray-800 hover:bg-gray-900 transition text-sm disabled:opacity-40"
                >
                  <Trash2Icon className="w-4 h-4" />
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* =========================
            TRAILER SECTION
        ========================= */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-gray-200">Trailers</p>

            <button
              type="button"
              onClick={addTrailer}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-gray-800 hover:bg-gray-900 transition text-sm"
            >
              <PlusIcon className="w-4 h-4" />
              Add Trailer
            </button>
          </div>

          <div className="space-y-3">
            {trailers.map((t, index) => (
              <div
                key={index}
                className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-white/5 border border-white/10 rounded-xl p-4"
              >
                <input
                  placeholder="Trailer Image URL (optional)"
                  value={t.image}
                  onChange={(e) => updateTrailer(index, "image", e.target.value)}
                  className="px-4 py-3 rounded-xl bg-gray-900/40 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-primary"
                />

                <input
                  placeholder="Trailer Video URL (YouTube/IMDb link)"
                  value={t.videoUrl}
                  onChange={(e) =>
                    updateTrailer(index, "videoUrl", e.target.value)
                  }
                  className="px-4 py-3 rounded-xl bg-gray-900/40 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-primary"
                />

                <button
                  type="button"
                  onClick={() => removeTrailer(index)}
                  disabled={trailers.length === 1}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gray-800 hover:bg-gray-900 transition text-sm disabled:opacity-40"
                >
                  <Trash2Icon className="w-4 h-4" />
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-4">
          <button
            type="submit"
            className="px-8 py-3 rounded-full bg-primary hover:bg-primary-dull transition font-medium active:scale-95"
          >
            Create Movie
          </button>

          <button
            type="button"
            onClick={resetAll}
            className="px-8 py-3 rounded-full bg-gray-800 hover:bg-gray-900 transition font-medium active:scale-95"
          >
            Reset
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateMovie;
