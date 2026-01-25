import AppError from "../utils/AppError.js";

const adminOnly = (req, res, next) => {
  if (req.user.role !== "ADMIN") {
    throw new AppError("Admin access only", 403);
  }
  next();
};

export default adminOnly;
