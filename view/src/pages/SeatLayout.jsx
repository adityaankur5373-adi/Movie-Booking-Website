import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-hot-toast";
import Loading from "../components/Loading";
import BlurCircle from "../components/BlurCircle";
import { ArrowRightIcon } from "lucide-react";
import { assets } from "../assets/assets";
import isoTimeFormat from "../lib/isoTimeFormat";
import api from "../api/api";
import useAuthStore from "../store/useAuthStore";
import { useLocation } from "react-router-dom";
const SeatLayout = () => {
  const location = useLocation();

useEffect(() => {
  if (location.state?.expired) {
    toast.error("Your booking expired. Please select seats again.");
  }
}, [location.state]);
  const { showId } = useParams();
  const navigate = useNavigate();

  const user = useAuthStore((s) => s.user);
  const [proceedLoading, setProceedLoading] = useState(false);
  const [show, setShow] = useState(null);
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [loading, setLoading] = useState(true);

  // ✅ prevent unlock when user clicks proceed (payment page needs lock)
  const proceedingRef = useRef(false);

  // ✅ Fetch show from backend
  useEffect(() => {
    const fetchShow = async () => {
      try {
        setLoading(true);

        const { data } = await api.get(`/shows/${showId}`);

        if (data?.success) {
          setShow(data.show);
        } else {
          setShow(null);
        }

        setSelectedSeats([]);
      } catch (err) {
        console.log("SeatLayout error:", err?.response?.data || err.message);
        toast.error("Failed to load show details");
        setShow(null);
      } finally {
        setLoading(false);
      }
    };

    fetchShow();
  }, [showId]);

  // ✅ Auto Refresh show (booked/locked seats update)
  const refreshShow = async () => {
    try {
      const { data } = await api.get(`/shows/${showId}`);
      if (data?.success) setShow(data.show);
    } catch (err) {
      console.log("refresh error:", err?.response?.data || err.message);
    }
  };

 useEffect(() => {
  if (!showId || proceedLoading) return; // ⛔ pause refresh while proceeding

  const interval = setInterval(() => {
    refreshShow();
  }, 3000);

  return () => clearInterval(interval);
}, [showId, proceedLoading]);

  // ✅ Layout from DB
  const layout = useMemo(() => show?.screen?.layout || null, [show]);

  // ✅ Booked seats from backend
  const bookedSeats = useMemo(() => show?.bookedSeats || [], [show]);

  // ✅ Locked seats from backend
  const lockedSeats = useMemo(() => show?.lockedSeats || [], [show]);

  // ✅ booked OR locked = unavailable
  const isUnavailable = (seatId) =>
    bookedSeats.includes(seatId) || lockedSeats.includes(seatId);

  const toggleSeat = (seatId) => {
    if (!show) return;

    if (isUnavailable(seatId)) return toast.error("Seat not available");

    if (!selectedSeats.includes(seatId) && selectedSeats.length >= 5) {
      return toast("You can only select 5 seats");
    }

    setSelectedSeats((prev) =>
      prev.includes(seatId)
        ? prev.filter((s) => s !== seatId)
        : [...prev, seatId]
    );
  };

  const seatClass = (selected, unavailable) =>
    `h-7 w-7 md:h-8 md:w-8 rounded-md border text-[10px] md:text-xs
     flex items-center justify-center transition active:scale-95
     ${
       unavailable
         ? "border-gray-700 text-gray-600 cursor-not-allowed"
         : "border-gray-400/40 text-gray-200 hover:border-white"
     }
     ${selected ? "bg-green-500/20 border-green-400 text-green-200" : ""}`;

  const renderRow = (secLabel, row, leftCount, rightCount) => {
  const left = Array.from({ length: leftCount }, (_, i) => `${row}${i + 1}`);
  const right = Array.from(
    { length: rightCount },
    (_, i) => `${row}${leftCount + i + 1}`
  );

  const makeSeatId = (seat) => `${secLabel}_${seat}`; // ✅ UNIQUE

  return (
    <div key={`${secLabel}_${row}`} className="flex items-center gap-4 mb-2">
      <p className="w-6 text-xs text-gray-400">{row}</p>

      {/* Left seats */}
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${leftCount}, 1fr)` }}
      >
        {left.map((seat) => {
          const seatId = makeSeatId(seat);

          return (
            <button
              key={seatId}
              disabled={isUnavailable(seatId)}
              onClick={() => toggleSeat(seatId)}
              className={seatClass(
                selectedSeats.includes(seatId),
                isUnavailable(seatId)
              )}
            >
              {seat.slice(1)}
            </button>
          );
        })}
      </div>

      {/* aisle */}
      <div className="w-8" />

      {/* Right seats */}
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${rightCount}, 1fr)` }}
      >
        {right.map((seat) => {
          const seatId = makeSeatId(seat);

          return (
            <button
              key={seatId}
              disabled={isUnavailable(seatId)}
              onClick={() => toggleSeat(seatId)}
              className={seatClass(
                selectedSeats.includes(seatId),
                isUnavailable(seatId)
              )}
            >
              {seat.slice(1)}
            </button>
          );
        })}
      </div>
    </div>
  );
};

  // ✅ UI TOTAL CALCULATION (layout-wise)
 const totalAmount = useMemo(() => {
  if (!layout?.sections?.length) return 0;

  let total = 0;

  for (const seatId of selectedSeats) {
    const [secLabel] = seatId.split("_"); // "SILVER" / "GOLD"
    const section = layout.sections.find((sec) => sec.label === secLabel);
    if (section?.price) total += Number(section.price);
  }

  return total;
}, [layout, selectedSeats]);
  // ✅ LOCK + go to payment page
     const handleProceed = async () => {
  if (!user) return toast.error("Please login");
  if (selectedSeats.length === 0) return toast("Select at least 1 seat");
  if (proceedLoading) return;

  try {
    setProceedLoading(true);

    // 1️⃣ Lock seats (Redis)
    await api.post(`/shows/${showId}/lock`, {
      seats: selectedSeats,
    });

    // 2️⃣ Create booking (DB)
    const bookingRes = await api.post("/bookings/create", {
      showId,
      seats: selectedSeats,
    });

    const bookingId = bookingRes.data.booking.id;

    // 3️⃣ Go to payment with ONLY bookingId
    navigate(`/payment/${showId}`, {
      state: { bookingId },
    });

    setSelectedSeats([]);
  } catch (err) {
    toast.error(err?.response?.data?.message || "Failed to proceed");
  } finally {
    setProceedLoading(false);
  }
};
 
  if (loading) return <Loading />;
  if (!show || !layout) return <Loading />;

  return (
    <div className="relative px-6 md:px-16 lg:px-40 pt-28 md:pt-40 pb-24 overflow-hidden min-h-[80vh]">
      <BlurCircle top="-100px" left="-100px" />
      <BlurCircle bottom="0" right="0" />

      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Select Seats</h1>
          <p className="text-sm text-gray-400 mt-1">
            {show?.movie?.title || "Movie"} • {show?.screen?.name || "Screen"} •{" "}
            {isoTimeFormat(show.startTime)}
          </p>
        </div>

        {/* Selected Summary */}
        <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur px-4 py-3">
          <p className="text-xs text-gray-400">Selected Seats</p>
          <p className="text-sm font-medium text-white">
            {selectedSeats.length > 0 ? selectedSeats.join(", ") : "None"}
          </p>
          <p className="text-xs text-gray-400 mt-1">Total: ₹{totalAmount}</p>
        </div>
      </div>

      {/* Screen Image */}
      <div className="mt-10 flex flex-col items-center">
        <img
          src={assets.screenImage}
          alt="screen"
          className="max-w-[420px] w-full"
        />
        <p className="text-gray-400 text-sm mt-2">SCREEN THIS WAY</p>
      </div>

      {/* Seat Sections */}
      <div className="max-w-3xl mx-auto mt-10">
        {layout.sections?.map((sec) => (
          <div key={sec.label} className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-gray-200 font-medium">{sec.label}</p>
              <p className="text-xs text-gray-400">₹{sec.price}</p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-5">
             {sec.rows?.map((row) =>
    renderRow(sec.label, row, sec.leftCount, sec.rightCount)
            )}

            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-gray-300">
        <div className="flex items-center gap-2">
          <span className="h-4 w-4 rounded border border-gray-400/40" />
          Available
        </div>
        <div className="flex items-center gap-2">
          <span className="h-4 w-4 rounded bg-green-500/20 border border-green-400" />
          Selected
        </div>
        <div className="flex items-center gap-2">
          <span className="h-4 w-4 rounded border border-gray-700 bg-gray-800" />
          Booked / Locked
        </div>
      </div>

      {/* Proceed Button */}
      <div className="mt-10 flex justify-center">
        <button
  onClick={handleProceed}
  disabled={proceedLoading}
  className="flex items-center gap-2 px-10 py-3 text-sm bg-primary hover:bg-primary-dull transition rounded-full font-medium cursor-pointer active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
>
  {proceedLoading ? "Locking..." : "Proceed to Checkout"}
  <ArrowRightIcon className="w-4 h-4" strokeWidth={3} />
</button>
      </div>
    </div>
  );
};

export default SeatLayout;
