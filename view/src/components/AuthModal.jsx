import { useState } from "react";
import { X } from "lucide-react";
import { GoogleLogin } from "@react-oauth/google";
import { loginApi, signupApi, googleLoginApi } from "../api/authApi";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import useAuthStore from "../store/useAuthStore";
const AuthModal = ({ isOpen, onClose }) => {
   const setUser = useAuthStore((s) => s.setUser);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState("login"); // login | signup
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [errors, setErrors] = useState({});
  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const validate = () => {
    const err = {};

    if (mode === "signup" && !form.name.trim()) err.name = "Name is required";

    if (!form.email.trim()) err.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      err.email = "Invalid email address";

    if (!form.password) err.password = "Password is required";
    else if (mode === "signup" && form.password.length < 6)
      err.password = "Password must be at least 6 characters";

    setErrors(err);
    return Object.keys(err).length === 0;
  };

  // ✅ EMAIL/PASSWORD MUTATION
  const authMutation = useMutation({
    mutationFn: async () => {
      if (mode === "signup") return signupApi(form);

      return loginApi({
        email: form.email,
        password: form.password,
      });
    },
   onSuccess: (res) => {
  const user = res?.data?.user;
  if (!user) return toast.error("User not found");

  setUser(user); 
  queryClient.setQueryData(["me"], user);// ✅ instant update
  onClose();

  toast.success(mode === "login" ? "Logged in successfully" : "Account created");

  if (user.role === "ADMIN") navigate("/admin", { replace: true });
},
   onError: (err) => {
const msg =
err?.response?.data?.message ||
(mode === "login" ? "Invalid email or password" : "Signup failed");


toast.error(msg);
},
  });

  const handleSubmit = () => {
    if (!validate()) return;
    authMutation.mutate();
  };

  // ✅ GOOGLE MUTATION
  const googleMutation = useMutation({
    mutationFn: (credential) => googleLoginApi(credential),
     onSuccess: (res) => {
  const user = res?.data?.user;
  if (!user) return toast.error("User not found");

  setUser(user); 
  queryClient.setQueryData(["me"], user);// ✅ instant update
  onClose();

  toast.success(mode === "login" ? "Logged in successfully" : "Account created");

  if (user.role === "ADMIN") navigate("/admin", { replace: true });
},  
     onError: (err) => {
const msg = err?.response?.data?.message || "Google login failed";
toast.error(msg);
},
  });

  const handleGoogleSuccess = (credentialResponse) => {
    googleMutation.mutate(credentialResponse.credential);
  };

  const loading = authMutation.isPending || googleMutation.isPending;
   if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center px-4">
      <div className="relative bg-white w-full max-w-sm rounded-xl p-6 shadow-lg">
        <X
          onClick={onClose}
          className="absolute top-4 right-4 cursor-pointer text-gray-500"
        />

        <h2 className="text-center text-lg font-semibold text-gray-800 mb-4">
          {mode === "login" ? "Log in" : "Create account"}
        </h2>

        <div className="flex justify-center mb-4">
          <GoogleLogin onSuccess={handleGoogleSuccess} />
        </div>

        <div className="text-center text-gray-400 text-sm mb-4">or</div>

        {mode === "signup" && (
          <>
            <input
              name="name"
              placeholder="Full name"
              value={form.name}
              onChange={handleChange}
              className="w-full mb-1 px-3 py-2 border border-gray-300 rounded-md 
                         bg-white text-black placeholder-gray-400 
                         focus:ring-2 focus:ring-purple-500"
            />
            {errors.name && (
              <p className="text-xs text-red-500 mb-2">{errors.name}</p>
            )}
          </>
        )}

        <input
          name="email"
          placeholder="Email address"
          value={form.email}
          onChange={handleChange}
          className="w-full mb-1 px-3 py-2 border border-gray-300 rounded-md 
                     bg-white text-black placeholder-gray-400 
                     focus:ring-2 focus:ring-purple-500"
        />
        {errors.email && (
          <p className="text-xs text-red-500 mb-2">{errors.email}</p>
        )}

        <input
          type="password"
          name="password"
          placeholder="Password"
          value={form.password}
          onChange={handleChange}
          className="w-full mb-1 px-3 py-2 border border-gray-300 rounded-md 
                     bg-white text-black placeholder-gray-400 
                     focus:ring-2 focus:ring-purple-500"
        />
        {errors.password && (
          <p className="text-xs text-red-500 mb-2">{errors.password}</p>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full bg-purple-600 hover:bg-purple-700 
                     text-white py-2 rounded-md mt-2 transition"
        >
          {loading ? "Please wait..." : mode === "login" ? "Log in" : "Sign up"}
        </button>

        <p className="text-center text-xs text-gray-500 mt-4">
          {mode === "login" ? (
            <>
              Don’t have an account?{" "}
              <span
                onClick={() => {
                  setMode("signup");
                  setErrors({});
                }}
                className="text-purple-600 cursor-pointer font-medium"
              >
                Sign up
              </span>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <span
                onClick={() => {
                  setMode("login");
                  setErrors({});
                }}
                className="text-purple-600 cursor-pointer font-medium"
              >
                Log in
              </span>
            </>
          )}
        </p>
      </div>
    </div>
  );
};

export default AuthModal;