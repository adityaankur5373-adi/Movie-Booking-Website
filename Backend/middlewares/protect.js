import jwt from "jsonwebtoken";
import asyncHandler from "./asyncHandler.js";
import AppError from "../utils/AppError.js";
import pkg from "@prisma/client";
const { PrismaClient } = pkg;

const prisma = new PrismaClient();

const protect = asyncHandler(async (req, res, next) => {
  const token = req.cookies?.token;

  if (!token) throw new AppError("Not authenticated", 401);

  const decoded = jwt.verify(token, process.env.JWT_SECRET);

  const user = await prisma.user.findUnique({
    where: { id: decoded.id },
    select: {
      id: true,
      name: true,
      email: true,
       role: true,
    },
  });

  if (!user) throw new AppError("User not found", 401);

  req.user = user;
  next();
});

export default protect;
