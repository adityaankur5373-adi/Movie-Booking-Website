import { useQuery } from "@tanstack/react-query";
import { MapPin, LocateFixed } from "lucide-react";

import {
  getCities,
  detectCity,
  fallbackCity,
  selectCity,
} from "../api/locationApi";

function CityModal() {
  const { data: cities = [] } = useQuery({
    queryKey: ["cities"],
    queryFn: getCities,
  });

  const handleDetectLocation = () => {
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        await detectCity(
          position.coords.latitude,
          position.coords.longitude
        );

        window.location.reload();
      },

      async () => {
        await fallbackCity();
        window.location.reload();
      }
    );
  };

  const handleSelectCity = async (city) => {
    await selectCity(city);
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm px-4">
      <div className="w-full max-w-xl rounded-3xl bg-white p-8 shadow-2xl">
        {/* Header */}
        <div className="flex flex-col items-center">
          <MapPin size={40} className="mb-3 text-black" />

          <h1 className="text-3xl font-bold text-black">
            Select Your City
          </h1>

          <p className="mt-2 text-center text-sm text-gray-500">
            Detect your current location or choose a city from the list below.
          </p>
        </div>

        {/* Detect Location Button */}
        <button
          onClick={handleDetectLocation}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-black py-3 text-white transition hover:bg-gray-900"
        >
          <LocateFixed size={18} />
          Detect My Location
        </button>

        {/* Divider */}
        <div className="my-6 flex items-center">
          <div className="h-px flex-1 bg-gray-300" />

          <span className="mx-4 text-sm text-gray-500">
            OR
          </span>

          <div className="h-px flex-1 bg-gray-300" />
        </div>

        {/* Cities */}
        <h2 className="mb-5 text-center text-xl font-semibold text-black">
          Choose a City
        </h2>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {cities.map((city) => (
            <button
              key={city}
              onClick={() => handleSelectCity(city)}
              className="rounded-lg border border-gray-300 py-3 text-sm font-medium text-black transition hover:bg-black hover:text-white"
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