import bcrypt from "bcrypt";
import pkg from "@prisma/client";
const { PrismaClient } = pkg;
import generateToken from "../utils/generateToken.js";
import { OAuth2Client } from "google-auth-library";
import asyncHandler from "../middlewares/asyncHandler.js";
import AppError from "../utils/AppError.js";

const prisma = new PrismaClient();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
 
// 🍪 Cookie options
const cookieOptions = {
  httpOnly: true,
  sameSite: process.env.NODE_ENV === "production",
  secure: process.env.NODE_ENV === "production",
  path: "/",     
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

// fields safe to expose
const safeSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
};



// ✅ SIGNUP
export const signup = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) throw new AppError("User already exists", 400);

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
      provider: "local",
    },
    select: safeSelect,   // 👈 only return safe fields
  });

  const token = generateToken(user);

  res.cookie("token", token, cookieOptions);
  res.status(201).json({ user });
});



// ✅ LOGIN
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

 const dbUser = await prisma.user.findUnique({
  where: { email },
select: {
       id: true,
    name: true,       
    email: true,     
    password: true,
    role: true,
    provider: true   
    },
});

  if (!dbUser || dbUser.provider !== "local") {
    throw new AppError("Invalid credentials", 400);
  }

  const isMatch = await bcrypt.compare(password, dbUser.password);
  if (!isMatch) throw new AppError("Invalid credentials", 400);

  const token = generateToken(dbUser);

  // return safe data only
  const user = {
    id: dbUser.id,
    name: dbUser.name,
    email: dbUser.email,
     role: dbUser.role,
  };

  res.cookie("token", token, cookieOptions);
  res.json({ user });
});



// ✅ GOOGLE LOGIN
export const googleAuth = asyncHandler(async (req, res) => {
  const { token } = req.body;

  const ticket = await googleClient.verifyIdToken({
    idToken: token,
    audience: process.env.GOOGLE_CLIENT_ID,
  });

  const { email, name, sub } = ticket.getPayload();

  let user = await prisma.user.findUnique({
    where: { email },
    select: safeSelect,
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        name,
        googleId: sub,
        provider: "google",
      },
      select: safeSelect,
    });
  }

  const jwtToken = generateToken(user);

  res.cookie("token", jwtToken, cookieOptions);
  res.json({ user });
});
export const getMe = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  });

  res.json({ user });
});
// authController.js
export const logout =  asyncHandler((req, res) => {
   res.clearCookie("token", {
    httpOnly: true,
    sameSite: process.env.NODE_ENV === "production",
    secure: process.env.NODE_ENV === "production" ? "none" : "lax",
    path: "/",
  });
  res.json({ message: "Logged out" });
});

// GET /api/movies/featured?limit=4
export const getFeaturedMovies = asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 4, 20);

  const movies = await prisma.movie.findMany({
    take: limit,
    include: {
      trailers: true,
      casts: true,
      genres: true,
    },
    orderBy: { createdAt: "desc" },
  });

  res.json({ success: true, movies });
});
