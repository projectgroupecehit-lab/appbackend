import { Router } from "express";
import { config } from "../config";

const router = Router();

router.get("/", (_req, res) => {
  res.json({
    latestVersion: config.appRelease.latestVersion,
    latestVersionName: config.appRelease.latestVersionName,
    apkUrl: config.appRelease.apkUrl,
    forceUpgrade: config.appRelease.forceUpgrade,
  });
});

export default router;
