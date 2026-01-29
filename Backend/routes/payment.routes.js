import express from "express";
import  protect  from "../middlewares/protect.js";
import { createPayment  } from "../controller/payment.controller.js";

const router = express.Router();

router.post("/:bookingId/pay", protect, createPayment);

export default router;
