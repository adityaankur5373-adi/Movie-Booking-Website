import express from "express";
import {
  getCurrentCity,
  setFallbackCity,
  selectCity,
  getAllCities,
  getCurrentSelectedCity,
} from "../controller/locationController.js";

const router = express.Router();

router.post(
  "/current-city",
  getCurrentCity
);
router.post(
    "/fallback-city",
    setFallbackCity
);
router.post(
  "/select-city",
  selectCity
);
router.get(
  "/current",
  getCurrentSelectedCity
);
router.get("/cities", getAllCities);
export default router;