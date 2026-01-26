import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";

import authRoutes from "./routes/authRoutes.js";
import movieRoutes from "./routes/movieRoutes.js";
import theatreRoutes from "./routes/theatreRoutes.js";
import showRoutes from "./routes/showRoutes.js";
import bookingRoutes from "./routes/bookingRoutes.js";
import adminRoutes from './routes/adminRoutes.js'
import { errorHandler } from "./middlewares/errorMiddleware.js";
import favouriteRoutes from "./routes/favourite.routes.js";
import paymentRoutes from "./routes/payment.routes.js";
dotenv.config();

const app = express();
// Middleware
app.use(
  cors({
    origin: ["https://movie-booking-website-x2bk.vercel.app"],
    credentials: true,
  })
);

app.use(cookieParser());
app.use(express.json());

// Routes
app.get("/", (req, res) => {
  res.send("API Running ✅");
});

app.use("api/auth", authRoutes);
app.use("api/movies", movieRoutes);
app.use("api/theatres", theatreRoutes);
app.use("api/shows", showRoutes);
app.use("api/bookings", bookingRoutes);
app.use("api/admin", adminRoutes);
app.use("api/favourites", favouriteRoutes);
app.use("api/payments", paymentRoutes);
// Error Middleware (always last)
app.use(errorHandler);

// Server
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
