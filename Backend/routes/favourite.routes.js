import express from "express";
import  protect  from "../middlewares/protect.js";
import {
  addFavourite,
  removeFavourite,
  checkFavourite,
  getMyFavourites,
} from "../controller/favourite.controller.js";

const router = express.Router();

// Add favourite
router.post("/", protect, addFavourite);

// Remove favourite
router.delete("/:movieId", protect, removeFavourite);

// Check if movie is favourite
router.get("/:movieId", protect, checkFavourite);

// Get all favourites of logged-in user
router.get("/", protect, getMyFavourites);

export default router;
