import { create } from "zustand";
import { getMe, logout as logoutApi } from "../api/authApi";

const useAuthStore = create((set) => ({
  user: null,
  isAuthenticated: false,
  loading: true,

  // after login / google login
  setUser: (user) =>
    set({
      user,                  // 👈 includes role
      isAuthenticated: true,
      loading: false,
    }),

  // restore session
  fetchUser: async () => {
    set({ loading: true });
    try {
      const res = await getMe(); // { user: { id, name, email, role } }

      set({
        user: res.data.user,     // 👈 role stored here
        isAuthenticated: true,
        loading: false,
      });
    } catch {
      set({
        user: null,
        isAuthenticated: false,
        loading: false,
      });
    }
  },

  // logout
  logout: async () => {
    try {
      await logoutApi();
    } finally {
      set({
        user: null,
        isAuthenticated: false,
        loading: false,
      });
    }
  },
}));

export default useAuthStore;


