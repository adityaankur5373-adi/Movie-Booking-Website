import { create } from "zustand";

const useAuthStore = create((set) => ({
  user: null,
  isAuthenticated: false,

  // ✅ important: tells routes session check is finished
  sessionReady: false,

  setUser: (user) =>
    set({
      user,
      isAuthenticated: true,
      sessionReady: true,
    }),

  clearUser: () =>
    set({
      user: null,
      isAuthenticated: false,
      sessionReady: true,
    }),

  // optional (when app starts)
  setSessionReady: () => set({ sessionReady: true }),
}));

export default useAuthStore;