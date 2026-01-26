import { Navigate } from "react-router-dom";
import useAuthStore from "../store/useAuthStore";
import { toast } from "react-hot-toast";
const AdminRoute = ({ children }) => {
  const user = useAuthStore((s) => s.user);
  const sessionReady = useAuthStore((s) => s.sessionReady);

  if (!sessionReady) return null;

  if (!user) return <Navigate to="/" replace />;

  if (String(user.role).toUpperCase() !== "ADMIN") {
    toast.error("Sorry you are not authorised");
    return <Navigate to="/" replace />;
  }

  return children;
};

export default AdminRoute;