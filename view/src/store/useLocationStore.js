import { create } from "zustand";

export const useLocationStore = create((set) => ({
  selectedCity: null,

  setSelectedCity: (city) =>
    set({ selectedCity: city }),
}));