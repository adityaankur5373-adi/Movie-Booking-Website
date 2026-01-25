import express from "express";
import protect from "../middlewares/protect.js";
import {
  signupValidator,
  loginValidator,
  googleAuthValidator
} from "../validators/authValidator.js";

import validateRequest from "../middlewares/validateRequest.js";
import { signup, login, googleAuth,logout,getMe} from "../controller/authController.js";

const router = express.Router();

router.post("/signup",signupValidator, validateRequest,signup);
router.post("/login",loginValidator, validateRequest,login);
router.post("/google", googleAuthValidator, validateRequest,googleAuth);
router.post("/logout",logout);
router.get("/me", protect, getMe);

export default router;
