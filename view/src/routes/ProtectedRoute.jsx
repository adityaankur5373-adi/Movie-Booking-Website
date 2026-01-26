import { Navigate } from "react-router-dom";
import useAuthStore from "../store/useAuthStore";
import { toast } from "react-hot-toast";
import { useEffect } from "react";

const ProtectedRoute = ({ children }) => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const sessionReady = useAuthStore((s) => s.sessionReady);

  useEffect(() => {
    if (sessionReady && !isAuthenticated) {
      toast.error("Login/Signup to continue");
    }
  }, [sessionReady, isAuthenticated]);

  if (!sessionReady) return null; // or <Loading />

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;