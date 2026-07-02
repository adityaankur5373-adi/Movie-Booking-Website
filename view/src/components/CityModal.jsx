import { useQuery } from "@tanstack/react-query";
import { MapPin, LocateFixed, X } from "lucide-react";

import {
  getCities,
  detectCity,
  fallbackCity,
  selectCity,
} from "../api/locationApi";

function CityModal({ onClose }) {
  const { data: cities = [] } = useQuery({
    queryKey: ["cities"],
    queryFn: getCities,
  });

  const handleDetectLocation = () => {
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          await detectCity(
            position.coords.latitude,
            position.coords.longitude
          );

          onClose(); // Close modal automatically
          window.location.reload();
        } catch (error) {
          console.error(error);
        }
      },

      async () => {
        try {
          await fallbackCity();

          onClose(); // Close modal automatically
          window.location.reload();
        } catch (error) {
          console.error(error);
        }
      }
    );
  };

  const handleSelectCity = async (city) => {
    try {
      await selectCity(city);

      onClose(); // Close modal automatically
      window.location.reload();
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-2 text-gray-500 transition hover:bg-gray-100 hover:text-black"
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div className="flex flex-col items-center">
          <MapPin
            size={36}
            className="mb-3 text-black sm:size-10"
          />

          <h1 className="text-2xl font-bold text-black sm:text-3xl">
            Select Your City
          </h1>

          <p className="mt-2 text-center text-xs text-gray-500 sm:text-sm">
            Detect your current location or choose a city below.
          </p>
        </div>

        {/* Detect Button */}
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

          <span className="mx-4 text-xs text-gray-500 sm:text-sm">
            OR
          </span>

          <div className="h-px flex-1 bg-gray-300" />
        </div>

        {/* Cities */}
        <h2 className="mb-4 text-center text-lg font-semibold text-black sm:text-xl">
          Choose a City
        </h2>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {cities.map((city) => (
            <button
              key={city}
              onClick={() => handleSelectCity(city)}
              className="rounded-lg border border-gray-300 px-3 py-3 text-sm font-medium text-black transition hover:bg-black hover:text-white"
            >
              {city}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default CityModal;