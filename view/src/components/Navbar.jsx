import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Menu, X, Ticket, MapPin } from "lucide-react";

import Profile from "./Profile.jsx";
import AuthModal from "./AuthModal.jsx";
import CityModal from "./CityModal.jsx";

import useAuthStore from "../store/useAuthStore";
import { useLocationStore } from "../store/useLocationStore";

const Navbar = () => {
  const isAuthenticated = useAuthStore(
    (s) => s.isAuthenticated
  );

  const { selectedCity } =
    useLocationStore();

  const [menuOpen, setMenuOpen] =
    useState(false);

  const [showAuth, setShowAuth] =
    useState(false);

  const [
    showCityModal,
    setShowCityModal,
  ] = useState(false);

  // Close auth modal after login
  useEffect(() => {
    if (isAuthenticated) {
      setShowAuth(false);
    }
  }, [isAuthenticated]);

  return (
    <>
      <nav className="fixed top-0 left-0 z-50 flex w-full items-center justify-between bg-transparent px-6 py-5 md:px-16 lg:px-36">
        {/* LOGO */}
        <Link
          to="/"
          className="flex flex-1 items-center gap-2 md:flex-none"
        >
          <Ticket className="h-10 w-10 text-primary" />

          <span className="text-xl font-bold">
            CineSwift
          </span>
        </Link>

        {/* MENU */}
        <div
          className={`max-md:absolute max-md:top-0 max-md:left-0 max-md:z-50
          flex flex-col items-center justify-center gap-8
          md:flex-row
          max-md:bg-black/80
          md:rounded-full md:border md:border-white/20
          md:bg-white/10 md:px-10 md:py-3
          md:backdrop-blur-md
          transition-all duration-300
          ${
            menuOpen
              ? "max-md:h-screen max-md:w-full"
              : "max-md:h-0 max-md:w-0 max-md:opacity-0"
          }`}
        >
          <X
            onClick={() =>
              setMenuOpen(false)
            }
            className="absolute top-6 right-6 h-6 w-6 cursor-pointer md:hidden"
          />

          <Link
            to="/"
            className="font-medium text-white/90 transition hover:text-white"
            onClick={() => {
              scrollTo(0, 0);
              setMenuOpen(false);
            }}
          >
            Home
          </Link>

          <Link
            to="/movies"
            className="font-medium text-white/90 transition hover:text-white"
            onClick={() => {
              scrollTo(0, 0);
              setMenuOpen(false);
            }}
          >
            Movies
          </Link>

          <Link
            to="/threater"
            className="font-medium text-white/90 transition hover:text-white"
            onClick={() => {
              scrollTo(0, 0);
              setMenuOpen(false);
            }}
          >
            Theatres
          </Link>

          <Link
            to="/movies-releases"
            className="font-medium text-white/90 transition hover:text-white"
            onClick={() => {
              scrollTo(0, 0);
              setMenuOpen(false);
            }}
          >
            Releases
          </Link>

          {isAuthenticated && (
            <Link
              to="/favourite"
              className="font-medium text-white/90 transition hover:text-white"
              onClick={() =>
                setMenuOpen(false)
              }
            >
              Favourites
            </Link>
          )}
        </div>

        {/* RIGHT SIDE */}
        <div className="flex items-center gap-3">
          {/* CITY BUTTON */}
          <button
            onClick={() =>
              setShowCityModal(true)
            }
            className="flex items-center gap-1 text-sm text-white/90 transition hover:text-white"
          >
            <MapPin className="h-4 w-4 text-primary" />

            <span className="max-w-[80px] truncate hidden sm:inline">
              {selectedCity ||
                "Select City"}
            </span>
          </button>

          {/* AUTH */}
          {isAuthenticated ? (
            <Profile />
          ) : (
            <button
              onClick={() => {
                setShowAuth(true);
                setMenuOpen(false);
              }}
              className="rounded-full bg-primary px-4 py-1 font-medium transition hover:bg-primary-dull sm:px-7 sm:py-2"
            >
              Login
            </button>
          )}

          {/* MOBILE MENU */}
          <Menu
            onClick={() =>
              setMenuOpen((prev) => !prev)
            }
            className="h-8 w-8 cursor-pointer md:hidden"
          />
        </div>
      </nav>

      {/* AUTH MODAL */}
      <AuthModal
        isOpen={showAuth}
        onClose={() =>
          setShowAuth(false)
        }
      />

      {/* CITY MODAL */}
      {showCityModal && (
        <CityModal
          canClose
          onClose={() =>
            setShowCityModal(false)
          }
        />
      )}
    </>
  );
};

export default Navbar;