import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import api from "../api/api";
import Loading from "../components/Loading";

const fetchMyBookings = async () => {
  const { data } = await api.get("/bookings/me");
  return data.bookings || [];
};

const MyBookings = () => {
  const navigate = useNavigate();

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ["myBookings"],
    queryFn: fetchMyBookings,
  });

  if (isLoading) return <Loading />;

  return (
    <div className="px-6 md:px-16 lg:px-40 pt-28">
      <h1 className="text-xl font-semibold mb-4">My Bookings</h1>

      {bookings.map((item) => (
        <div
          key={item.id}
          className="border rounded-xl p-4 mb-4 flex justify-between"
        >
          <div>
            <p className="font-semibold">
              {item.show.movie.title}
            </p>
            <p className="text-sm text-gray-500">
              Seats: {item.bookedSeats.join(", ")}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <p className="font-semibold">₹{item.totalAmount}</p>

            {!item.isPaid && (
              <button
                onClick={() =>
                  navigate(`/payment/${item.showId}`, {
                    state: {
                      bookingId: item.id,
                    },
                  })
                }
                className="bg-primary px-4 py-1.5 rounded-full text-sm text-white"
              >
                Pay Now
              </button>
            )}

            {item.isPaid && (
              <button
                onClick={() => navigate(`/ticket/${item.id}`)}
                className="underline text-sm"
              >
                View Ticket
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default MyBookings;