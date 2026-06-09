import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import { json } from "body-parser";
import router from "./routes";
import { errorHandler } from "./middleware/error.middleware";
import { config } from "./config";

export function createApp() {
  const app = express();

  // Security & middleware
  app.use(helmet());
  const defaultCorsOrigins = [
    /^http:\/\/localhost:\d+$/,
    /^http:\/\/127\.0\.0\.1:\d+$/,
    /^http:\/\/10\.0\.2\.2:\d+$/,
  ];
  const configuredCorsOrigins = config.corsOrigins;

  app.use(cors({
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true);
      }

      const isAllowed =
        configuredCorsOrigins.includes(origin) ||
        defaultCorsOrigins.some((allowedOrigin) => allowedOrigin.test(origin));

      return callback(isAllowed ? null : new Error("Not allowed by CORS"), isAllowed);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }));
  app.use(json());
  app.use(cookieParser());
  app.use(rateLimit({ windowMs: 60 * 1000, max: 120 }));

 app.get("/", (req, res) => {
  res.send("SmartWater API is running 🚀");
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api", router);

  // Error handler
  app.use(errorHandler);

  return app;
}
