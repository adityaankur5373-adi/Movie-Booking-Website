import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LogOut, Ticket } from "lucide-react";
import useAuthStore from "../store/useAuthStore";
import { useLogout } from "../hooks/useLogout";

const Profile = () => {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
   console.log("USER:", user);
  const { mutate: logout, isPending } = useLogout();

  const [open, setOpen] = useState(false);
  const profileRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout(undefined, {
      onSuccess: () => {
        setOpen(false);
        navigate("/", { replace: true });
      },
    });
  };

  return (
    <div className="relative" ref={profileRef}>
      {/* Avatar Button */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="focus:outline-none"
      >
        <img
          src={`https://ui-avatars.com/api/?name=${
            user?.name || user?.email || "User"
          }&background=ef4444&color=fff&bold=true`}
          alt="avatar"
          className="w-9 h-9 rounded-full border-2 border-red-300 hover:scale-105 transition"
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 mt-4 w-64 bg-white rounded-xl shadow-xl overflow-hidden animate-fadeIn">
          {/* Profile Header */}
          <div className="px-4 py-4 bg-linear-to-r bg-primary/80 text-white">
            <div className="flex items-center gap-3">
              <img
                src={`https://ui-avatars.com/api/?name=${
                  user?.name || user?.email || "User"
                }&background=fff&color=7c3aed&bold=true`}
                alt="avatar"
                className="w-12 h-12 rounded-full"
              />
              <div>
                <p className="font-semibold leading-tight">
                  {user?.name || "User"}
                </p>
                <p className="text-xs opacity-90 truncate w-36">
                  {user?.email}
                </p>
              </div>
            </div>
          </div>

          {/* Menu */}
          <div className="py-2 text-sm">
            <Link
              to="/my-bookings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-3 hover:bg-gray-100 transition text-black"
            >
              <Ticket className="w-4 h-4 text-red-600" />
              <span>My Bookings</span>
            </Link>

            <button
              onClick={handleLogout}
              disabled={isPending}
              className="flex items-center gap-3 w-full text-left px-4 py-3 
                         text-red-600 hover:bg-red-50 transition disabled:opacity-60"
            >
              <LogOut className="w-4 h-4" />
              {isPending ? "Logging out..." : "Logout"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;