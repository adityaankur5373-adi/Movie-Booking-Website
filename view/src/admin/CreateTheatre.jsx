import { useState } from "react";
import { toast } from "react-hot-toast";
import Title from "../admincomponents/Title";
import BlurCircle from "../components/BlurCircle";
import api from "../api/api";
import Loading from "../components/Loading";
import { Building2Icon, MapPinIcon } from "lucide-react";

const CreateTheatre = () => {
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    name: "",
    city: "",
    area: "",
    address: "",
  });

  const handleChange = (e) => {
    setForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const validate = () => {
    if (!form.name.trim()) return "Theatre name is required";
    if (!form.city.trim()) return "City is required";
    if (!form.area.trim()) return "Area is required";
    if (!form.address.trim()) return "Address is required";
    return null;
  };

  const resetForm = () => {
    setForm({
      name: "",
      city: "",
      area: "",
      address: "",
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const error = validate();
    if (error) return toast.error(error);

    try {
      setLoading(true);

      const payload = {
        name: form.name.trim(),
        city: form.city.trim(),
        area: form.area.trim(),
        address: form.address.trim(),
      };

      const { data } = await api.post("/theatres", payload);

      if (data?.success) {
        toast.success("Theatre created successfully ✅");
        resetForm();
      } else {
        toast.error("Failed to create theatre");
      }
    } catch (err) {
      console.log("CreateTheatre error:", err?.response?.data || err.message);
      toast.error(err?.response?.data?.message || "Theatre create failed");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Loading />;

  return (
    <div className="relative px-6 md:px-16 lg:px-40 pt-28 md:pt-36 pb-24 overflow-hidden min-h-[80vh]">
      <BlurCircle top="-100px" left="-80px" />
      <BlurCircle bottom="0px" right="0px" />

      <Title text1="Create" text2="Theatre" />

      <form
        onSubmit={handleSubmit}
        className="mt-8 max-w-3xl rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-6"
      >
        {/* Theatre Name */}
        <div className="mb-4">
          <label className="text-sm text-gray-300 flex items-center gap-2">
            <Building2Icon className="w-4 h-4" />
            Theatre Name *
          </label>
          <input
            name="name"
            value={form.name}
            onChange={handleChange}
            placeholder="PVR: Phoenix Mall"
            className="mt-2 w-full px-4 py-3 rounded-xl bg-gray-900/40 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-primary"
          />
        </div>

        {/* City + Area */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-sm text-gray-300 flex items-center gap-2">
              <MapPinIcon className="w-4 h-4" />
              City *
            </label>
            <input
              name="city"
              value={form.city}
              onChange={handleChange}
              placeholder="Lucknow"
              className="mt-2 w-full px-4 py-3 rounded-xl bg-gray-900/40 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="text-sm text-gray-300">Area *</label>
            <input
              name="area"
              value={form.area}
              onChange={handleChange}
              placeholder="Alambagh"
              className="mt-2 w-full px-4 py-3 rounded-xl bg-gray-900/40 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        {/* Address */}
        <div className="mb-6">
          <label className="text-sm text-gray-300">Full Address *</label>
          <textarea
            name="address"
            value={form.address}
            onChange={handleChange}
            placeholder="Phoenix United Mall, Lucknow"
            rows={3}
            className="mt-2 w-full px-4 py-3 rounded-xl bg-gray-900/40 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-primary"
          />
        </div>

        {/* Buttons */}
        <div className="flex gap-4">
          <button
            type="submit"
            className="px-8 py-3 rounded-full bg-primary hover:bg-primary-dull transition font-medium active:scale-95"
          >
            Create Theatre
          </button>

          <button
            type="button"
            onClick={resetForm}
            className="px-8 py-3 rounded-full bg-gray-800 hover:bg-gray-900 transition font-medium active:scale-95"
          >
            Reset
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateTheatre;
