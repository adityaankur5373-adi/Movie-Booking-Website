import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import Title from "../admincomponents/Title";
import BlurCircle from "../components/BlurCircle";
import api from "../api/api";
import Loading from "../components/Loading";
import { PlusIcon, Trash2Icon, LayoutGridIcon } from "lucide-react";

const CreateScreen = () => {
  const [loading, setLoading] = useState(false);

  const [theatres, setTheatres] = useState([]);
  const [fetching, setFetching] = useState(true);

  const [form, setForm] = useState({
    theatreId: "",
    name: "",
    screenNo: "", // ✅ added
  });

  const [sections, setSections] = useState([
    {
      label: "SILVER",
      price: 160,
      rows: "A,B",
      leftCount: 4,
      rightCount: 4,
    },
  ]);

  // ✅ fetch theatres
  useEffect(() => {
    const fetchTheatres = async () => {
      try {
        setFetching(true);
        const { data } = await api.get("/theatres");

        if (data?.success) {
          setTheatres(data.theatres || []);
        } else {
          toast.error("Failed to load theatres");
        }
      } catch (err) {
        console.log("Fetch theatres error:", err?.response?.data || err.message);
        toast.error("Failed to load theatres");
      } finally {
        setFetching(false);
      }
    };

    fetchTheatres();
  }, []);

  const handleChange = (e) => {
    setForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  // =========================
  // SECTION HANDLERS
  // =========================
  const updateSection = (index, key, value) => {
    setSections((prev) => {
      const copy = [...prev];
      copy[index][key] = value;
      return copy;
    });
  };

  const addSection = () => {
    setSections((prev) => [
      ...prev,
      { label: "", price: 0, rows: "", leftCount: 4, rightCount: 4 },
    ]);
  };

  const removeSection = (index) => {
    setSections((prev) => prev.filter((_, i) => i !== index));
  };

  const validate = () => {
    if (!form.theatreId) return "Select a theatre";
    if (!form.name.trim()) return "Screen name is required";

    if (!form.screenNo || Number(form.screenNo) <= 0)
      return "Screen No is required";

    for (const sec of sections) {
      if (!sec.label.trim()) return "Section label is required";
      if (!sec.price || Number(sec.price) <= 0)
        return "Section price must be > 0";
      if (!sec.rows.trim()) return "Rows are required (ex: A,B,C)";
      if (!sec.leftCount || Number(sec.leftCount) <= 0)
        return "Left count must be > 0";
      if (!sec.rightCount || Number(sec.rightCount) <= 0)
        return "Right count must be > 0";
    }

    return null;
  };

  const resetAll = () => {
    setForm({ theatreId: "", name: "", screenNo: "" });
    setSections([
      {
        label: "SILVER",
        price: 160,
        rows: "A,B",
        leftCount: 4,
        rightCount: 4,
      },
    ]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const error = validate();
    if (error) return toast.error(error);

    try {
      setLoading(true);

      const layout = {
        sections: sections.map((s) => ({
          label: s.label.trim(),
          price: Number(s.price),
          rows: s.rows
            .split(",")
            .map((r) => r.trim().toUpperCase())
            .filter(Boolean),
          leftCount: Number(s.leftCount),
          rightCount: Number(s.rightCount),
        })),
      };

      const payload = {
        name: form.name.trim(),
        screenNo: Number(form.screenNo), // ✅ required by backend
        layout,
      };

      // ✅ correct route (no :theatreId)
      const { data } = await api.post(
        `/theatres/${form.theatreId}/screens`,
        payload
      );

      if (data?.success) {
        toast.success("Screen created successfully ✅");
        resetAll();
      } else {
        toast.error(data?.message || "Failed to create screen");
      }
    } catch (err) {
      console.log("CreateScreen error:", err?.response?.data || err.message);
      toast.error(err?.response?.data?.message || "Screen create failed");
    } finally {
      setLoading(false);
    }
  };

  if (loading || fetching) return <Loading />;

  return (
    <div className="relative px-6 md:px-16 lg:px-40 pt-28 md:pt-36 pb-24 overflow-hidden min-h-[80vh]">
      <BlurCircle top="-100px" left="-80px" />
      <BlurCircle bottom="0px" right="0px" />

      <Title text1="Create" text2="Screen" />

      <form
        onSubmit={handleSubmit}
        className="mt-8 max-w-4xl rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-6"
      >
        {/* Theatre Select */}
        <div className="mb-4">
          <label className="text-sm text-gray-300">Select Theatre *</label>
          <select
            name="theatreId"
            value={form.theatreId}
            onChange={handleChange}
            className="mt-2 w-full px-4 py-3 rounded-xl bg-gray-900/40 border border-white/10 text-white focus:outline-none focus:border-primary"
          >
            <option value="">-- Select Theatre --</option>
            {theatres.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} • {t.city}
              </option>
            ))}
          </select>
        </div>

        {/* Screen Name */}
        <div className="mb-4">
          <label className="text-sm text-gray-300">Screen Name *</label>
          <input
            name="name"
            value={form.name}
            onChange={handleChange}
            placeholder="Audi 1"
            className="mt-2 w-full px-4 py-3 rounded-xl bg-gray-900/40 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-primary"
          />
        </div>

        {/* Screen No */}
        <div className="mb-6">
          <label className="text-sm text-gray-300">Screen No *</label>
          <input
            name="screenNo"
            type="number"
            min={1}
            value={form.screenNo}
            onChange={handleChange}
            placeholder="1"
            className="mt-2 w-full px-4 py-3 rounded-xl bg-gray-900/40 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-primary"
          />
        </div>

        {/* Sections */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-gray-200 flex items-center gap-2">
              <LayoutGridIcon className="w-4 h-4" />
              Seat Sections
            </p>

            <button
              type="button"
              onClick={addSection}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-gray-800 hover:bg-gray-900 transition text-sm"
            >
              <PlusIcon className="w-4 h-4" />
              Add Section
            </button>
          </div>

          <div className="space-y-4">
            {sections.map((sec, index) => (
              <div
                key={index}
                className="rounded-xl border border-white/10 bg-white/5 p-4"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input
                    placeholder="Label (SILVER/GOLD)"
                    value={sec.label}
                    onChange={(e) =>
                      updateSection(index, "label", e.target.value)
                    }
                    className="px-4 py-3 rounded-xl bg-gray-900/40 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-primary"
                  />

                  <input
                    type="number"
                    placeholder="Price"
                    value={sec.price}
                    onChange={(e) =>
                      updateSection(index, "price", e.target.value)
                    }
                    className="px-4 py-3 rounded-xl bg-gray-900/40 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-primary"
                  />

                  <input
                    placeholder="Rows (A,B,C)"
                    value={sec.rows}
                    onChange={(e) =>
                      updateSection(index, "rows", e.target.value)
                    }
                    className="px-4 py-3 rounded-xl bg-gray-900/40 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                  <input
                    type="number"
                    placeholder="Left seats count"
                    value={sec.leftCount}
                    onChange={(e) =>
                      updateSection(index, "leftCount", e.target.value)
                    }
                    className="px-4 py-3 rounded-xl bg-gray-900/40 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-primary"
                  />

                  <input
                    type="number"
                    placeholder="Right seats count"
                    value={sec.rightCount}
                    onChange={(e) =>
                      updateSection(index, "rightCount", e.target.value)
                    }
                    className="px-4 py-3 rounded-xl bg-gray-900/40 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-primary"
                  />

                  <button
                    type="button"
                    onClick={() => removeSection(index)}
                    disabled={sections.length === 1}
                    className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gray-800 hover:bg-gray-900 transition text-sm disabled:opacity-40"
                  >
                    <Trash2Icon className="w-4 h-4" />
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-4">
          <button
            type="submit"
            className="px-8 py-3 rounded-full bg-primary hover:bg-primary-dull transition font-medium active:scale-95"
          >
            Create Screen
          </button>

          <button
            type="button"
            onClick={resetAll}
            className="px-8 py-3 rounded-full bg-gray-800 hover:bg-gray-900 transition font-medium active:scale-95"
          >
            Reset
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateScreen;
