import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true, // allows JWT cookies
  timeout: 30000
});

export default api;
