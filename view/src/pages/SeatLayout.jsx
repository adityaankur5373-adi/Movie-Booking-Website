import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { toast } from "react-hot-toast";
import Loading from "../components/Loading";
import BlurCircle from "../components/BlurCircle";
import { ArrowRightIcon } from "lucide-react";
import { assets } from "../assets/assets";
import isoTimeFormat from "../lib/isoTimeFormat";
import api from "../api/api";
import useAuthStore from "../store/useAuthStore";

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

  const proceedingRef = useRef(false);

  // ========================
  // Fetch show
  // ========================
  useEffect(() => {
    const fetchShow = async () => {
      try {
        setLoading(true);
        const { data } = await api.get(`/shows/${showId}`);
        if (data?.success) setShow(data.show);
        else setShow(null);
        setSelectedSeats([]);
      } catch (err) {
        toast.error("Failed to load show details");
        setShow(null);
      } finally {
        setLoading(false);
      }
    };
    fetchShow();
  }, [showId]);

  // ========================
  // Auto refresh show
  // ========================
  const refreshShow = async () => {
    try {
      const { data } = await api.get(`/shows/${showId}`);
      if (data?.success) setShow(data.show);
    } catch {}
  };

  useEffect(() => {
    if (!showId || proceedLoading || selectedSeats.length > 0) return;
    const interval = setInterval(refreshShow, 3000);
    return () => clearInterval(interval);
  }, [showId, proceedLoading, selectedSeats.length]);

  // ========================
  // Layout + booked seats
  // ========================
  const layout = useMemo(() => show?.screen?.layout || null, [show]);
  const bookedSeats = useMemo(() => show?.bookedSeats || [], [show]);

  const isUnavailable = (seatId) => bookedSeats.includes(seatId);

  const toggleSeat = (seatId) => {
    if (!show) return;

    if (isUnavailable(seatId)) {
      return toast.error("Seat not available");
    }

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

    const makeSeatId = (seat) => `${secLabel}_${seat}`;

    return (
      <div key={`${secLabel}_${row}`} className="flex items-center gap-4 mb-2">
        <p className="w-6 text-xs text-gray-400">{row}</p>

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

        <div className="w-8" />

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

  const handleProceed = async () => {
    if (!user) return toast.error("Please login");
    if (selectedSeats.length === 0) return toast("Select at least 1 seat");
    if (proceedLoading) return;

    try {
      setProceedLoading(true);

      const { data } = await api.post("/bookings/create", {
        showId,
        seats: selectedSeats,
      });

      const bookingId = data.bookingId;
      navigate(`/checkout/${bookingId}`);
      setSelectedSeats([]);
    } catch (err) {
      toast.error(
        err?.response?.data?.message ||
          "Seat no longer available. Please select again."
      );
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

      <div className="mt-10 flex flex-col items-center">
        <img src={assets.screenImage} alt="screen" className="max-w-[420px]" />
        <p className="text-gray-400 text-sm mt-2">SCREEN THIS WAY</p>
      </div>

      {/* ⭐ FIXED WRAPPER */}
      <div className="w-full max-w-6xl mx-auto mt-10 overflow-x-auto">
        {layout.sections?.map((sec) => (
          <div key={sec.label} className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-gray-200 font-medium">{sec.label}</p>
              <p className="text-xs text-gray-400">₹{sec.price}</p>
            </div>

            {/* ⭐ ADDED min-w-max */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-5 min-w-max">
              {sec.rows?.map((row) =>
                renderRow(sec.label, row, sec.leftCount, sec.rightCount)
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-10 flex justify-center">
        <button
          onClick={handleProceed}
          disabled={proceedLoading}
          className="flex items-center gap-2 px-10 py-3 text-sm bg-primary hover:bg-primary-dull transition rounded-full font-medium active:scale-95 disabled:opacity-60"
        >
          {proceedLoading ? "Locking..." : "Proceed to Checkout"}
          <ArrowRightIcon className="w-4 h-4" strokeWidth={3} />
        </button>
      </div>
    </div>
  );
};

export default SeatLayout;
