import api from "./api";

// Email/Password
export const loginApi = (data) => api.post("/auth/login", data);
export const signupApi = (data) => api.post("/auth/signup", data);

// Google Login (credential/token)
export const googleLoginApi = (token) => api.post("/auth/google", { token });

// Logout + Session
export const logoutApi = () => api.post("/auth/logout");
export const getMe = () => api.get("/auth/me");