import { useState } from "react";
import { toast } from "react-hot-toast";
import {
  Building2Icon,
  MapPinIcon,
  NavigationIcon,
} from "lucide-react";

import Title from "../admincomponents/Title";
import BlurCircle from "../components/BlurCircle";
import Loading from "../components/Loading";
import api from "../api/api";

const CreateTheatre = () => {
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    name: "",
    city: "",
    area: "",
    address: "",
    latitude: "",
    longitude: "",
  });

  const handleChange = (e) => {
    setForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const validate = () => {
    if (!form.name.trim())
      return "Theatre name is required";

    if (!form.city.trim())
      return "City is required";

    if (!form.area.trim())
      return "Area is required";

    if (!form.address.trim())
      return "Address is required";

    if (!form.latitude)
      return "Latitude is required";

    if (!form.longitude)
      return "Longitude is required";

    if (isNaN(Number(form.latitude)))
      return "Latitude must be a number";

    if (isNaN(Number(form.longitude)))
      return "Longitude must be a number";

    return null;
  };

  const resetForm = () => {
    setForm({
      name: "",
      city: "",
      area: "",
      address: "",
      latitude: "",
      longitude: "",
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const error = validate();

    if (error) {
      return toast.error(error);
    }

    try {
      setLoading(true);

      const payload = {
        name: form.name.trim(),
        city: form.city.trim(),
        area: form.area.trim(),
        address: form.address.trim(),
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
      };

      const { data } = await api.post(
        "/threater",
        payload
      );

      if (data?.success) {
        toast.success(
          "Theatre created successfully ✅"
        );

        resetForm();
      } else {
        toast.error(
          "Failed to create theatre"
        );
      }
    } catch (err) {
      console.log(
        "CreateTheatre error:",
        err?.response?.data ||
          err.message
      );

      toast.error(
        err?.response?.data?.message ||
          "Theatre create failed"
      );
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Loading />;

  return (
    <div className="relative min-h-[80vh] overflow-hidden px-6 pt-28 pb-24 md:px-16 md:pt-36 lg:px-40">
      <BlurCircle top="-100px" left="-80px" />
      <BlurCircle bottom="0px" right="0px" />

      <Title text1="Create" text2="Theatre" />

      <form
        onSubmit={handleSubmit}
        className="mt-8 max-w-3xl rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur"
      >
        {/* Theatre Name */}
        <div className="mb-4">
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <Building2Icon className="h-4 w-4" />
            Theatre Name *
          </label>

          <input
            name="name"
            value={form.name}
            onChange={handleChange}
            placeholder="PVR: Phoenix Mall"
            className="mt-2 w-full rounded-xl border border-white/10 bg-gray-900/40 px-4 py-3 text-white placeholder-gray-500 focus:border-primary focus:outline-none"
          />
        </div>

        {/* City + Area */}
        <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="flex items-center gap-2 text-sm text-gray-300">
              <MapPinIcon className="h-4 w-4" />
              City *
            </label>

            <input
              name="city"
              value={form.city}
              onChange={handleChange}
              placeholder="Kolkata"
              className="mt-2 w-full rounded-xl border border-white/10 bg-gray-900/40 px-4 py-3 text-white placeholder-gray-500 focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="text-sm text-gray-300">
              Area *
            </label>

            <input
              name="area"
              value={form.area}
              onChange={handleChange}
              placeholder="Salt Lake"
              className="mt-2 w-full rounded-xl border border-white/10 bg-gray-900/40 px-4 py-3 text-white placeholder-gray-500 focus:border-primary focus:outline-none"
            />
          </div>
        </div>

        {/* Latitude + Longitude */}
        <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="flex items-center gap-2 text-sm text-gray-300">
              <NavigationIcon className="h-4 w-4" />
              Latitude *
            </label>

            <input
              type="number"
              step="any"
              name="latitude"
              value={form.latitude}
              onChange={handleChange}
              placeholder="22.5726"
              className="mt-2 w-full rounded-xl border border-white/10 bg-gray-900/40 px-4 py-3 text-white placeholder-gray-500 focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="text-sm text-gray-300">
              Longitude *
            </label>

            <input
              type="number"
              step="any"
              name="longitude"
              value={form.longitude}
              onChange={handleChange}
              placeholder="88.3639"
              className="mt-2 w-full rounded-xl border border-white/10 bg-gray-900/40 px-4 py-3 text-white placeholder-gray-500 focus:border-primary focus:outline-none"
            />
          </div>
        </div>

        {/* Address */}
        <div className="mb-6">
          <label className="text-sm text-gray-300">
            Full Address *
          </label>

          <textarea
            name="address"
            value={form.address}
            onChange={handleChange}
            placeholder="South City Mall, Kolkata"
            rows={3}
            className="mt-2 w-full rounded-xl border border-white/10 bg-gray-900/40 px-4 py-3 text-white placeholder-gray-500 focus:border-primary focus:outline-none"
          />
        </div>

        {/* Buttons */}
        <div className="flex flex-wrap gap-4">
          <button
            type="submit"
            className="rounded-full bg-primary px-8 py-3 font-medium transition hover:bg-primary-dull active:scale-95"
          >
            Create Theatre
          </button>

          <button
            type="button"
            onClick={resetForm}
            className="rounded-full bg-gray-800 px-8 py-3 font-medium transition hover:bg-gray-900 active:scale-95"
          >
            Reset
          </button>
        </div>
      </form>
    </div>
  );
};
export default CreateTheatre;