import mqtt from "mqtt";
import { config } from "../config";
import { TelemetryModel } from "../models/telemetry.model";
import { DeviceModel } from "../models/device.model";
import { StatusModel } from "../models/status.model";
import { io } from "./socket.service";
import { logger } from "../utils/logger";

export function initMqtt() {
  const client = mqtt.connect(config.mqttUrl, {
    username: process.env.MQTT_USERNAME,
    password: process.env.MQTT_PASSWORD,
  });

  client.on("connect", () => {
    logger.info("MQTT connected");
    client.subscribe("devices/+/telemetry", (err) => {
      if (err) logger.error("subscribe err", err);
    });
  });

  client.on("error", (err) => {
    logger.warn("MQTT connection error", err);
  });

  client.on("offline", () => {
    logger.warn("MQTT client offline");
  });

  client.on("message", async (topic, message) => {
    try {
      // topic = devices/{deviceId}/telemetry
      const parts = topic.split("/");
      const deviceId = parts[1];
      const payload = JSON.parse(message.toString());

      const metrics = payload.metrics || payload;
      const timestamp = payload.ts ? new Date(payload.ts) : new Date();

      // 1️⃣ Store historical telemetry
      const tele = await TelemetryModel.create({
        deviceId,
        ts: timestamp,
        tds: metrics.tds,
        ph: metrics.ph,
        tempC: metrics.tempC || metrics.temperature,
        conductivity: metrics.conductivity,
        turbidity: metrics.turbidity,
        dissolved_oxygen: metrics.dissolved_oxygen,
        flowLpm: metrics.flowLpm,
        tankPct: metrics.tankPct,
        raw: payload,
      });

      // 2️⃣ Update Device collection with latest parameters
      await DeviceModel.findOneAndUpdate(
        { deviceId },
        {
          $set: {
            status: "online",
            lastSeen: timestamp,
            latest: {
              ph: metrics.ph,
              tds: metrics.tds,
              turbidity: metrics.turbidity,
              temperature: metrics.tempC || metrics.temperature,
              conductivity: metrics.conductivity,
              dissolved_oxygen: metrics.dissolved_oxygen,
              flowLpm: metrics.flowLpm,
              tankPct: metrics.tankPct,
            }
          }
        },
        { upsert: true, new: true }
      );

      // 3️⃣ Update StatusModel (legacy compatibility)
      await StatusModel.updateOne(
        { deviceId },
        {
          $set: {
            online: true,
            lastSeen: timestamp,
            metrics: metrics,
          },
        },
        { upsert: true }
      );

      // 4️⃣ Emit real-time update via Socket.IO
      const deviceData = {
        deviceId,
        timestamp,
        metrics: {
          ph: metrics.ph,
          tds: metrics.tds,
          turbidity: metrics.turbidity,
          temperature: metrics.tempC || metrics.temperature,
          conductivity: metrics.conductivity,
          dissolved_oxygen: metrics.dissolved_oxygen,
          flowLpm: metrics.flowLpm,
          tankPct: metrics.tankPct,
        }
      };
      
      io && io.to(`device:${deviceId}`).emit("telemetry", deviceData);
      logger.info(`📊 Telemetry updated for device ${deviceId}`);
    } catch (err) {
      logger.error("mqtt message error", err);
    }
  });

  return client;
}
