import BlurCircle from "../components/BlurCircle";
import { MapPinIcon, FilmIcon, ArrowRightIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../api/api";
import Loading from "../components/Loading";
import { useQuery } from "@tanstack/react-query";

const fetchTheatres = async () => {
  const { data } = await api.get("/theatres");
  if (!data?.success) return [];
  return data.theatres || [];
};

const Theatres = () => {
  const navigate = useNavigate();

  const {
    data: theatres = [],
    isLoading,
    refetch,
    isError,
  } = useQuery({
    queryKey: ["theatres"],
    queryFn: fetchTheatres,
    staleTime: 2 * 60 * 1000,
  });

  if (isLoading) return <Loading />;

  return theatres.length > 0 ? (
    <div className="relative my-40 mb-60 px-6 md:px-16 lg:px-40 xl:px-44 overflow-hidden min-h-[80vh]">
      <BlurCircle top="150px" left="0px" />
      <BlurCircle bottom="150px" right="0px" />

      <h1 className="text-lg font-medium my-4">Theatres</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
        {theatres.map((theatre) => (
          <div
            key={theatre.id}
            className="w-[280px] rounded-xl border border-white/10 bg-white/5 backdrop-blur p-5 hover:bg-white/10 transition"
          >
            <h2 className="text-base font-semibold mt-3">{theatre.name}</h2>

            <div className="mt-3 space-y-2 text-sm text-gray-300">
              <p className="flex items-center gap-2">
                <MapPinIcon className="w-4 h-4 text-primary" />
                {theatre.area ? `${theatre.area}, ` : ""}
                {theatre.city}
              </p>

              <p className="flex items-center gap-2">
                <FilmIcon className="w-4 h-4 text-primary" />
                {theatre?._count?.screenList ?? 0} Screens
              </p>

              <p className="text-xs text-gray-400 line-clamp-2">
                {theatre.address || "Address not available"}
              </p>
            </div>

            <button
              onClick={() => navigate(`/threater/${theatre.id}`)}
              className="mt-5 w-full flex items-center justify-center gap-2 px-4 py-2 text-sm bg-primary hover:bg-primary-dull transition rounded-md font-medium cursor-pointer active:scale-95"
            >
              View Shows <ArrowRightIcon className="w-4 h-4" strokeWidth={3} />
            </button>
          </div>
        ))}
      </div>
    </div>
  ) : (
    <div className="flex flex-col items-center justify-center h-screen gap-4">
      <h1 className="text-3xl md:text-5xl font-bold text-center">
        {isError ? "Failed to load theatres" : "No theatres available"}
      </h1>

      <button
        onClick={() => refetch()}
        className="px-6 py-2 text-sm bg-primary hover:bg-primary-dull transition rounded-md font-medium"
      >
        Refresh
      </button>
    </div>
  );
};

export default Theatres;
