import { Router } from "express";
import authRoutes from "./auth.routes";
import devicesRoutes from "./devices.routes";
import ingestRoutes from "./ingest.routes";
import telemetryRoutes from "./telemetry.routes";
import userRoutes from "./user.routes";
import analysisRoutes from "./analysis.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/devices", devicesRoutes);
router.use("/ingest", ingestRoutes);
router.use("/telemetry", telemetryRoutes);
router.use("/user", userRoutes);
router.use("/analysis", analysisRoutes);

export default router;
