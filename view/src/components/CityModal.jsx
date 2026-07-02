import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MapPin, LocateFixed, X } from "lucide-react";

import {
  getCities,
  detectCity,
  fallbackCity,
  selectCity,
} from "../api/locationApi";

function CityModal() {
  const queryClient = useQueryClient();

  const { data: cities = [], isLoading } = useQuery({
    queryKey: ["cities"],
    queryFn: getCities,
  });

  const refreshSelectedCity = async () => {
    await queryClient.invalidateQueries({
      queryKey: ["selected-city"],
    });
  };

  const handleDetectLocation = () => {
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          await detectCity(
            position.coords.latitude,
            position.coords.longitude
          );

          await refreshSelectedCity();
        } catch (error) {
          console.error(error);
        }
      },

      async () => {
        try {
          await fallbackCity();

          await refreshSelectedCity();
        } catch (error) {
          console.error(error);
        }
      }
    );
  };

  const handleSelectCity = async (city) => {
    try {
      await selectCity(city);

      await refreshSelectedCity();
    } catch (error) {
      console.error(error);
    }
  };

  const handleClose = async () => {
    try {
      await fallbackCity();

      await refreshSelectedCity();
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl sm:p-6 md:p-8">
        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute right-4 top-4 rounded-full p-2 text-gray-500 transition hover:bg-gray-100 hover:text-black"
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div className="flex flex-col items-center">
          <div className="rounded-full bg-gray-100 p-3">
            <MapPin size={28} className="text-black sm:size-8" />
          </div>

          <h1 className="mt-4 text-center text-2xl font-bold text-black sm:text-3xl">
            Select Your City
          </h1>

          <p className="mt-2 max-w-xs text-center text-sm text-gray-500">
            Detect your current location or choose a city to continue.
          </p>
        </div>

        {/* Detect Location Button */}
        <button
          onClick={handleDetectLocation}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-black py-3 text-sm font-medium text-white transition hover:bg-gray-900 sm:text-base"
        >
          <LocateFixed size={18} />
          Detect My Location
        </button>

        {/* Divider */}
        <div className="my-6 flex items-center">
          <div className="h-px flex-1 bg-gray-300" />

          <span className="mx-4 text-xs font-medium text-gray-500 sm:text-sm">
            OR
          </span>

          <div className="h-px flex-1 bg-gray-300" />
        </div>

        {/* Cities */}
        <h2 className="mb-4 text-center text-lg font-semibold text-black">
          Choose a City
        </h2>

        {isLoading ? (
          <p className="text-center text-sm text-gray-500">
            Loading cities...
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {cities.map((city) => (
              <button
                key={city}
                onClick={() => handleSelectCity(city)}
                className="rounded-xl border border-gray-300 px-4 py-3 text-sm font-medium text-black transition hover:bg-black hover:text-white"
              >
                {city}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default CityModal;