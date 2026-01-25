import { Router } from "express";
import protect from "../middlewares/protect.js";
import adminOnly from "../middlewares/adminOnly.js";
import { getAdminDashboard } from "../controller/admin.controller.js";

const router = Router();

router.get("/dashboard", protect, adminOnly, getAdminDashboard);

export default router;
