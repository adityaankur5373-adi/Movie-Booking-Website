import express from "express";
import  protect  from "../middlewares/protect.js";
import { createPaymentIntent } from "../controller/payment.controller.js";

const router = express.Router();

router.post("/create-intent", protect, createPaymentIntent);

export default router;
