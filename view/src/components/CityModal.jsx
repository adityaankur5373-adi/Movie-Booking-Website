import { useEffect, useState } from "react";
import { MapPin, LocateFixed, X } from "lucide-react";
import { toast } from "react-hot-toast";

import {
  getCities,
  detectCity,
  fallbackCity,
  selectCity,
} from "../api/locationApi";

import { useLocationStore } from "../store/useLocationStore";

function CityModal({ onClose }) {
  const { setSelectedCity } = useLocationStore();

  const [cities, setCities] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchCities = async () => {
      try {
        setIsLoading(true);

        const data = await getCities();

        setCities(data);
      } catch (error) {
        toast.error("Failed to load cities");
      } finally {
        setIsLoading(false);
      }
    };

    fetchCities();
  }, []);

  const handleDetectLocation = () => {
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const data = await detectCity(
            position.coords.latitude,
            position.coords.longitude
          );

          setSelectedCity(data.city);
           onClose?.(); // IMPORTANT
        } catch (error) {
          toast.error(
            error?.response?.data?.message ||
              "No theatres available nearby"
          );
        }
      },

      async () => {
        try {
          const data = await fallbackCity();

          setSelectedCity(data.city);
          onClose?.();

        } catch (error) {
          toast.error("Failed to set default city");
        }
      }
    );
  };

  const handleSelectCity = async (city) => {
    try {
      const data = await selectCity(city);

      setSelectedCity(data.city);
      onClose?.();
    } catch (error) {
      toast.error(
        error?.response?.data?.message ||
          "Failed to select city"
      );
    }
  };

  const handleClose = async () => {
    try {
      const data = await fallbackCity();

      setSelectedCity(data.city);
       onClose?.(); // IMPORTANT
    } catch (error) {
      toast.error("Failed to close modal");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
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
            <MapPin
              size={24}
              className="text-black"
            />
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

          <span className="mx-3 text-xs text-gray-500">
            OR
          </span>

          <div className="h-px flex-1 bg-gray-300" />
        </div>

        {/* Cities */}
        <h3 className="mb-3 text-center text-base font-semibold text-black">
          Choose a City
        </h3>

        {isLoading ? (
          <p className="text-center text-sm text-gray-500">
            Loading cities...
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {cities.map((city) => (
              <button
                key={city}
                onClick={() =>
                  handleSelectCity(city)
                }
                className="rounded-lg bg-black px-3 py-2 text-sm font-medium text-white transition active:scale-95"
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