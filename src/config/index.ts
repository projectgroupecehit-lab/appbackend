import dotenv from "dotenv";
dotenv.config();

const nodeEnv = process.env.NODE_ENV || "development";
const isProduction = nodeEnv === "production";

export const config = {
  port: process.env.PORT || 4000,
  nodeEnv,
  // Require an explicit MongoDB Atlas connection string. No local fallback.
  mongoUri: process.env.MONGO_URI || "",
  mongoDbName: process.env.MONGO_DB_NAME || "main",
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || (isProduction ? "" : "secret_access"),
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || (isProduction ? "" : "secret_refresh"),
  accessExpiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || "15m",
  refreshExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || "30d",
  mqttEnabled: process.env.MQTT_ENABLED === "true",
  mqttUrl: process.env.MQTT_URL || "",
  googleSheet: {
    id: process.env.GOOGLE_SHEET_ID || "",
    gid: process.env.GOOGLE_SHEET_GID || "0",
    deviceId: process.env.GOOGLE_SHEET_DEVICE_ID || "",
    syncOnStart: process.env.GOOGLE_SHEET_SYNC_ON_START === "true",
    syncIntervalMs: Number(process.env.GOOGLE_SHEET_SYNC_INTERVAL_MS || 0),
    syncSecret: process.env.GOOGLE_SHEET_SYNC_SECRET || "",
  },
  corsOrigins: (process.env.CORS_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  pythonBin: process.env.PYTHON_BIN || (process.platform === "win32" ? "python" : "python3"),
  google: {
    androidClientId: process.env.GOOGLE_ANDROID_CLIENT_ID,
    webClientId: process.env.GOOGLE_WEB_CLIENT_ID,
    clientId: process.env.GOOGLE_CLIENT_ID,
  },
  appRelease: {
    latestVersion: Number(process.env.APP_LATEST_VERSION || 9),
    latestVersionName: process.env.APP_LATEST_VERSION_NAME || "1.8",
    apkUrl: process.env.APP_APK_URL || "",
    forceUpgrade: process.env.APP_FORCE_UPGRADE === "true",
  },
};

export function validateRequiredConfig() {
  const missing = [];

  if (!config.mongoUri) missing.push("MONGO_URI");
  if (!config.jwtAccessSecret) missing.push("JWT_ACCESS_SECRET");
  if (!config.jwtRefreshSecret) missing.push("JWT_REFRESH_SECRET");
  if (config.mqttEnabled && !config.mqttUrl) missing.push("MQTT_URL");

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}
