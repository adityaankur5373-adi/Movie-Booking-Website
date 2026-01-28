import express from "express";
import  protect  from "../middlewares/protect.js";
import { createPaymentIntent,cancelPayment  } from "../controller/payment.controller.js";

const router = express.Router();

router.post("/create-intent", protect, createPaymentIntent);
router.post("/cancel",protect,cancelPayment )
export default router;
