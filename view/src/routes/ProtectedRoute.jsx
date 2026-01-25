import { Navigate } from "react-router-dom";
import useAuthStore from "../store/useAuthStore";
import { toast } from 'react-hot-toast'
const ProtectedRoute = ({ children }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
 const loading = useAuthStore((state) =>state.loading )
  if (loading) return null;
  if (!isAuthenticated) {
    toast.error('Please login/signup to continue')
    return <Navigate to="/" replace />
  };

  return children;
};

export default ProtectedRoute;
