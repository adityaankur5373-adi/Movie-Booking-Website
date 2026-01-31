import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { assets } from "../assets/assets";
import Profile from "./Profile.jsx";
import AuthModal from "./AuthModal.jsx";
import useAuthStore from "../store/useAuthStore";
import { Ticket } from "lucide-react";


const Navbar = () => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showAuth, setShowAuth] = useState(false);

  // ✅ auto close modal if user logged in
  useEffect(() => {
    if (isAuthenticated) setShowAuth(false);
  }, [isAuthenticated]);

  return (
    <>
      <nav className="fixed top-0 left-0 z-50 w-full flex items-center justify-between px-6 md:px-16 lg:px-36 py-5 bg-transparent">
        {/* LOGO */}
        <Link to="/" className="flex items-center gap-2 flex-1 md:flex-none">
  <Ticket className="w-10 h-10 text-primary" />
  <span className="text-xl font-bold">
    MovieShow
  </span>
</Link>

        {/* MENU */}
        <div
          className={`max-md:absolute max-md:top-0 max-md:left-0 max-md:z-50
          flex flex-col md:flex-row items-center justify-center gap-8
          max-md:bg-black/80
          md:bg-white/10 md:backdrop-blur-md
          md:border md:border-white/20
          md:rounded-full md:px-10 md:py-3
          transition-all duration-300
          ${
            menuOpen
              ? "max-md:w-full max-md:h-screen"
              : "max-md:w-0 max-md:h-0 max-md:opacity-0"
          }`}
        >
          <X
            onClick={() => setMenuOpen(false)}
            className="md:hidden absolute top-6 right-6 w-6 h-6 cursor-pointer"
          />

          <Link
            className="text-white/90 hover:text-white transition font-medium"
            onClick={() => {
              scrollTo(0, 0);
              setMenuOpen(false);
            }}
            to="/"
          >
            Home
          </Link>

          <Link
            className="text-white/90 hover:text-white transition font-medium"
            onClick={() => {
              scrollTo(0, 0);
              setMenuOpen(false);
            }}
            to="/movies"
          >
            Movies
          </Link>

          <Link
            className="text-white/90 hover:text-white transition font-medium"
            onClick={() => {
              scrollTo(0, 0);
              setMenuOpen(false);
            }}
            to="/threater"
          >
            Theatres
          </Link>

          <Link
            className="text-white/90 hover:text-white transition font-medium"
            onClick={() => {
              scrollTo(0, 0);
              setMenuOpen(false);
            }}
            to="/movies-releases"
          >
            Releases
          </Link>

          {isAuthenticated && (
            <Link
              className="text-white/90 hover:text-white transition font-medium"
              onClick={() => setMenuOpen(false)}
              to="/favourite"
            >
              Favourites
            </Link>
          )}
        </div>

        {/* RIGHT SIDE */}
        <div className="flex items-center gap-6">
          {/* AUTH / PROFILE */}
          {isAuthenticated ? (
            <Profile />
          ) : (
            <button
              onClick={() => {
                setShowAuth(true);
                setMenuOpen(false); // ✅ close mobile menu
              }}
              className="px-4 py-1 sm:px-7 sm:py-2 bg-primary hover:bg-primary-dull transition rounded-full font-medium"
            >
              Login
            </button>
          )}

          {/* MOBILE MENU */}
          <Menu
            onClick={() => setMenuOpen((prev) => !prev)}
            className="md:hidden w-8 h-8 cursor-pointer"
          />
        </div>
      </nav>

      {/* AUTH MODAL */}
      <AuthModal isOpen={showAuth} onClose={() => setShowAuth(false)} />
    </>
  );
};

export default Navbar;