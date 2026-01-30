
import { Routes, Route } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { useSession } from "./hooks/useSession";

// layouts
import MainLayout from "./layouts/MainLayout";
import AdminLayout from "./layouts/AdminLayout";

// guards
import ProtectedRoute from "./routes/ProtectedRoute";
import AdminRoute from "./routes/AdminRoute";

// pages
import Home from "./pages/Home";
import Movies from "./pages/Movies";
import MovieDetails from "./pages/MovieDetails";
import SeatLayout from "./pages/SeatLayout";
import MyBookings from "./pages/MyBookings";
import Favourite from "./pages/Favourite";
import NotFound from "./pages/NotFound";
import Loading from "./components/Loading";
import Payment from "./pages/Payment";
import Releases from "./pages/Releases";
import TicketPage from "./pages/TicketPage";
import Threaters from "./pages/Theatres";
import TheatreDetails from "./pages/TheatreDetails";
import MovieTheatres from "./pages/MovieTheatres";
import PaymentSuccess from "./pages/PaymentSuccess";
// admin
import AdminDashboard from "./admin/AdminDashboard";
import ListBooking from "./admin/ListBooking";
import ListShows from "./admin/ListShows";
import AddShows from "./admin/AddShows";
import CreateMovie from "./admin/CreateMovie";
import CreateTheatre from "./admin/CreateTheatre";
import CreateScreen from "./admin/CreateScreen";

const App = () => {
  const { isLoading } = useSession();

  if (isLoading) return <Loading />;

  return (
    <>
      <Toaster />

      <Routes>
        {/* MAIN LAYOUT */}
        <Route element={<MainLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/movies" element={<Movies />} />
          <Route path="/movies/:id" element={<MovieDetails />} />
          <Route path="/shows/:showId/seats" element={<SeatLayout />} />

          <Route path="/threater" element={<Threaters />} />
          <Route path="/threaters/:theatreId" element={<TheatreDetails />} />
          <Route path="/movies/:movieId/theatres" element={<MovieTheatres />} />
         
          <Route
            path="/my-bookings"
            element={
              <ProtectedRoute>
                <MyBookings />
              </ProtectedRoute>
            }
          />

          <Route
            path="/favourite"
            element={
              <ProtectedRoute>
                <Favourite />
              </ProtectedRoute>
            }
          />

          <Route
            path="/ticket/:bookingId"
            element={
              <ProtectedRoute>
                <TicketPage />
              </ProtectedRoute>
            }
          />
        </Route>

        {/* OTHER ROUTES (NO LAYOUT) */}
        <Route
          path="/checkout/:bookingId"
          element={
            <ProtectedRoute>
              <Payment />
            </ProtectedRoute>
          }
        />
        <Route path="/movies-releases" element={<Releases />} />
            <Route
  path="/payment/success/:bookingId"
  element={<PaymentSuccess />}
/>
        {/* ADMIN LAYOUT */}
        <Route element={<AdminLayout />}>
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminDashboard />
              </AdminRoute>
            }
          />

          <Route
            path="/admin/add-movies"
            element={
              <AdminRoute>
                <AddShows />
              </AdminRoute>
            }
          />

          <Route
            path="/admin/booking-list"
            element={
              <AdminRoute>
                <ListBooking />
              </AdminRoute>
            }
          />

          <Route
            path="/admin/shows-list"
            element={
              <AdminRoute>
                <ListShows />
              </AdminRoute>
            }
          />

          <Route
            path="/admin/create-movie"
            element={
              <AdminRoute>
                <CreateMovie />
              </AdminRoute>
            }
          />

          <Route
            path="/admin/create-theatre"
            element={
              <AdminRoute>
                <CreateTheatre />
              </AdminRoute>
            }
          />

          <Route
            path="/admin/create-screen"
            element={
              <AdminRoute>
                <CreateScreen />
              </AdminRoute>
            }
          />
        </Route>

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
};

export default App;