import { Navigate } from "react-router-dom";
import useAuthStore from "../store/useAuthStore";
import { toast } from 'react-hot-toast'
const AdminRoute = ({ children }) => {
  const  user = useAuthStore((state) => state.user);
  const loading = useAuthStore((state) =>state.loading )
  if (loading) return null;
  if (!user || user.role !== "ADMIN") {
    toast.error("Sorry you are not Authorised")
    return <Navigate to="/" replace />;
  }

  return children;
};

export default AdminRoute;
