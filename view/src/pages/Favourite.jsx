import { useQuery } from "@tanstack/react-query";
import Moviecard from "../components/Moviecard";
import BlurCircle from "../components/BlurCircle";
import api from "../api/api";
import Loading from "../components/Loading";

const fetchFavourites = async () => {
  const { data } = await api.get("/favourites");
  if (!data?.success) return [];
  return data.favourites || [];
};

const Favourite = () => {
  const {
    data: favourite = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["favourites"],
    queryFn: fetchFavourites,
    staleTime: 30 * 1000,
  });

  if (isLoading) return <Loading />;

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <h1 className="text-2xl font-bold text-center text-red-400">
          Failed to load favourites
        </h1>
      </div>
    );
  }

  return favourite.length > 0 ? (
    <div className="relative my-40 mb-60 px-6 md:px-16 lg:px-40 xl:px-44 overflow-hidden min-h-[80vh]">
      <BlurCircle top="150px" left="0px" />
      <BlurCircle bottom="150px" right="0px" />

      <h1 className="text-lg font-medium my-4">Your Favourite movies</h1>

      <div className="flex flex-wrap max-sm:justify-center gap-8">
        {favourite.map((movie) => (
          <Moviecard movie={movie} key={movie.id} />
        ))}
      </div>
    </div>
  ) : (
    <div className="flex flex-col items-center justify-center h-screen">
      <h1 className="text-5xl font-bold text-center">No favourite movies</h1>
    </div>
  );
};

export default Favourite;
