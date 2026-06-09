import { Router } from "express";
import * as devices from "../controllers/devices.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();
router.post("/claim", requireAuth, devices.claimDevice);
router.get("/", requireAuth, devices.listDevices);
router.get("/:deviceId/status", devices.getDeviceStatus);
router.get("/:deviceId/latest", devices.getLatestReading);

export default router;
