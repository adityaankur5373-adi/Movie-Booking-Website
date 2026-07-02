import { prisma } from "../config/prisma.js";
import asyncHandler from "../middlewares/asyncHandler.js";
import AppError from "../utils/AppError.js";
import { haversine } from "../utils/haversine.js";
import axios from "axios";
export const getCurrentCity = asyncHandler(
  async (req, res) => {
    const { latitude, longitude } =
      req.body;

    if (
      latitude === undefined ||
      longitude === undefined
    ) {
      throw new AppError(
        "Latitude and longitude are required",
        400
      );
    }

    const theatres =
      await prisma.theatre.findMany({
        select: {
          city: true,
          latitude: true,
          longitude: true,
        },
      });

    let nearest = null;
    let minDistance = Infinity;

    for (const theatre of theatres) {
      const distance = haversine(
        latitude,
        longitude,
        theatre.latitude,
        theatre.longitude
      );

      if (distance < minDistance) {
        minDistance = distance;
        nearest = theatre;
      }
    }

    if (!nearest) {
      throw new AppError(
        "No theatres found",
        404
      );
    }

    // ✅ Backend sets cookie
    res.cookie(
      "selectedCity",
      nearest.city,
      {
        maxAge:
          30 * 24 * 60 * 60 * 1000, // 30 days

        httpOnly: true, // frontend can read if needed

        secure:
          process.env.NODE_ENV ===
          "production",

        sameSite: "lax",
      }
    );

    res.json({
      success: true,
      city: nearest.city,
    });
  }
);


export const setFallbackCity = asyncHandler(
  async (req, res) => {

    const response = await axios.get(
      "http://ip-api.com/json/"
    );

    let city = response.data.city;

    // Check if we support this city
    const theatre = await prisma.theatre.findFirst({
      where: { city },
    });

    if (!theatre) {
      city = "Dhanbad"; // default fallback
    }

    res.cookie(
      "selectedCity",
      city,
      {
        httpOnly: true,
        secure:
          process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge:
          30 * 24 * 60 * 60 * 1000,
      }
    );

    res.json({
      success: true,
      city,
    });
  }
);
export const selectCity = asyncHandler(
  async (req, res) => {

    const { city } = req.body;

    if (!city?.trim()) {
      throw new AppError(
        "City is required",
        400
      );
    }

    const exists =
      await prisma.theatre.findFirst({
        where: {
          city: city.trim(),
        },
      });

    if (!exists) {
      throw new AppError(
        "City not supported",
        404
      );
    }

    res.cookie(
      "selectedCity",
      city.trim(),
      {
        httpOnly: true,
        secure:
          process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge:
          30 * 24 * 60 * 60 * 1000,
      }
    );

    res.json({
      success: true,
      city: city.trim(),
    });
  }
);

export const getAllCities = asyncHandler(async (req, res) => {
  const theatres = await prisma.theatre.findMany({
    distinct: ["city"],
    select: {
      city: true,
    },
    orderBy: {
      city: "asc",
    },
  });

  const cities = theatres.map((t) => t.city);

  res.status(200).json({
    success: true,
    cities,
  });
});
export const getCurrentSelectedCity = asyncHandler(
  async (req, res) => {
    res.json({
      success: true,
      city: req.cookies.selectedCity || null,
    });
  }
);