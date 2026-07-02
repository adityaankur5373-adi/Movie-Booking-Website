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
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl p-10">
        {/* Header */}
        <div className="flex flex-col items-center">
          <MapPin size={48} className="text-black mb-4" />

          <h1 className="text-4xl font-bold text-black">
            Select Your City
          </h1>

          <p className="text-gray-600 mt-3 text-center">
            Detect your current location or choose a city from
            the list below.
          </p>
        </div>

        {/* Detect Button */}
        <button
          onClick={handleDetectLocation}
          className="w-full mt-8 bg-black text-white py-4 rounded-xl
          font-semibold flex items-center justify-center gap-3
          hover:bg-gray-900 transition"
        >
          <LocateFixed size={20} />
          Detect My Location
        </button>

        {/* Divider */}
        <div className="flex items-center my-8">
          <div className="flex-1 h-[1px] bg-gray-300" />
          <span className="mx-4 text-gray-500 font-medium">OR</span>
          <div className="flex-1 h-[1px] bg-gray-300" />
        </div>

        {/* Cities */}
        <h2 className="text-2xl font-bold text-center mb-6">
          Choose a City
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {cities.map((city) => (
            <button
              key={city}
              onClick={() => handleSelectCity(city)}
              className="border border-gray-300 rounded-xl py-4
              text-black font-medium hover:bg-black
              hover:text-white transition"
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