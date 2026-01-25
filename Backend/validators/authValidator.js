import { body } from "express-validator";

export const signupValidator = [
  body("name")
    .trim()
    .notEmpty().escape().withMessage("Name is required"),

  body("email")
    .isEmail().withMessage("Invalid email format"),

  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters"),
];

export const loginValidator = [
  body("email")
    .isEmail().withMessage("Invalid email"),

  body("password")
    .notEmpty().withMessage("Password is required"),
];

export const googleAuthValidator = [
  body("token")
    .notEmpty().withMessage("Google token is required"),
];
