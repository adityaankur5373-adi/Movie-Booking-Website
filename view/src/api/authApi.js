import api from "./api";

export const login = (data) => api.post("/auth/login", data);
export const signup = (data) => api.post("/auth/signup", data);
export const googleLogin = (token) => api.post("/auth/google", { token });
export const logout = () => api.post("/auth/logout");
export const getMe = () => api.get("/auth/me");
