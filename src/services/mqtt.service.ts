import mqtt from "mqtt";
import { config } from "../config";
import { DeviceModel } from "../models/device.model";
import { StatusModel } from "../models/status.model";
import { TempReadingModel } from "../models/temp-reading.model";
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
      const parts = topic.split("/");
      const deviceId = parts[1];
      const payload = JSON.parse(message.toString());
      const metrics = payload.metrics || payload;
      const timestamp = payload.ts ? new Date(payload.ts) : new Date();
      const temperature = metrics.temperature ?? metrics.tempC;
      const ec = metrics.ec ?? metrics.conductivity;
      const dissolvedOxygen = metrics.do ?? metrics.dissolved_oxygen;

      await TempReadingModel.create({
        device_id: deviceId,
        temperature,
        ph: metrics.ph,
        tds: metrics.tds,
        do: dissolvedOxygen,
        ec,
        turbidity: metrics.turbidity,
        createdAt: timestamp,
        updatedAt: timestamp,
      });

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
              temperature,
              conductivity: ec,
              dissolved_oxygen: dissolvedOxygen,
              flowLpm: metrics.flowLpm,
              tankPct: metrics.tankPct,
            },
          },
        },
        { upsert: true, new: true }
      );

      await StatusModel.updateOne(
        { deviceId },
        {
          $set: {
            online: true,
            lastSeen: timestamp,
            metrics,
          },
        },
        { upsert: true }
      );

      const deviceData = {
        deviceId,
        timestamp,
        metrics: {
          ph: metrics.ph,
          tds: metrics.tds,
          turbidity: metrics.turbidity,
          temperature,
          tempC: temperature,
          conductivity: ec,
          ec,
          dissolved_oxygen: dissolvedOxygen,
          do: dissolvedOxygen,
          flowLpm: metrics.flowLpm,
          tankPct: metrics.tankPct,
        },
      };

      io && io.to(`device:${deviceId}`).emit("telemetry", deviceData);
      logger.info(`Telemetry updated for device ${deviceId}`);
    } catch (err) {
      logger.error("mqtt message error", err);
    }
  });

  return client;
}
