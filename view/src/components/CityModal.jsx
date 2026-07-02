import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MapPin, LocateFixed, X } from "lucide-react";
import { toast } from "react-hot-toast";

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

  const refreshCity = async () => {
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

          await refreshCity();
        } catch (error) {
          toast.error(
            error?.response?.data?.message ||
              "No theatres available nearby"
          );
        }
      },
      async () => {
        try {
          await fallbackCity();
          await refreshCity();
        } catch (error) {
          toast.error("Failed to set default city");
        }
      }
    );
  };

  const handleSelectCity = async (city) => {
    try {
      await selectCity(city);
      await refreshCity();
    } catch (error) {
      toast.error(error?.response?.data?.message);
    }
  };

  const handleClose = async () => {
    try {
      await fallbackCity();
      await refreshCity();
    } catch (error) {
      toast.error("Failed to close modal");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-3">
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute right-3 top-3 rounded-full p-1.5 text-gray-500 transition hover:bg-gray-100"
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div className="flex flex-col items-center">
          <div className="rounded-full bg-gray-100 p-3">
            <MapPin size={24} />
          </div>

          <h2 className="mt-3 text-xl font-bold text-black sm:text-2xl">
            Select Your City
          </h2>

          <p className="mt-1 text-center text-xs text-gray-500 sm:text-sm">
            Detect your location or choose a city manually.
          </p>
        </div>

        {/* Detect Button */}
        <button
          onClick={handleDetectLocation}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-black py-3 text-sm font-medium text-white transition hover:bg-gray-900"
        >
          <LocateFixed size={16} />
          Detect My Location
        </button>

        {/* Divider */}
        <div className="my-5 flex items-center">
          <div className="h-px flex-1 bg-gray-300" />
          <span className="mx-3 text-xs text-gray-500">OR</span>
          <div className="h-px flex-1 bg-gray-300" />
        </div>

        {/* Cities */}
        <h3 className="mb-3 text-center text-base font-semibold">
          Choose a City
        </h3>

        {isLoading ? (
          <p className="text-center text-sm text-gray-500">
            Loading...
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {cities.map((city) => (
              <button
                key={city}
                onClick={() => handleSelectCity(city)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium transition hover:bg-black hover:text-white"
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