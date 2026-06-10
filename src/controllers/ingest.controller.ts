import { Request, Response } from "express";
import { StatusModel } from "../models/status.model";
import { normalizeTempReading, TempReadingModel } from "../models/temp-reading.model";
import { io } from "../services/socket.service";

export async function ingest(req: Request, res: Response) {
  const {
    deviceId,
    device_id,
    ts,
    tds,
    ph,
    temperature,
    tempC,
    ec,
    conductivity,
    turbidity,
    do: dissolvedOxygenShort,
    dissolved_oxygen,
    flowLpm,
    tankPct,
  } = req.body;

  const resolvedDeviceId = device_id || deviceId;
  if (!resolvedDeviceId) return res.status(400).json({ message: "device_id or deviceId required" });

  const timestamp = ts ? new Date(ts) : new Date();
  const resolvedTemperature = temperature ?? tempC;
  const resolvedEc = ec ?? conductivity;
  const resolvedDo = dissolvedOxygenShort ?? dissolved_oxygen;

  const reading = await TempReadingModel.create({
    device_id: resolvedDeviceId,
    temperature: resolvedTemperature,
    ph,
    tds,
    do: resolvedDo,
    ec: resolvedEc,
    turbidity,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  const normalized = normalizeTempReading(reading);

  await StatusModel.updateOne(
    { deviceId: resolvedDeviceId },
    {
      $set: {
        online: true,
        lastSeen: timestamp,
        metrics: {
          tds,
          ph,
          temperature: resolvedTemperature,
          tempC: resolvedTemperature,
          conductivity: resolvedEc,
          ec: resolvedEc,
          turbidity,
          dissolved_oxygen: resolvedDo,
          do: resolvedDo,
          flowLpm,
          tankPct,
        },
      },
    },
    { upsert: true }
  );

  io.to(`device:${resolvedDeviceId}`).emit("telemetry", normalized);

  res.json({ ok: true, data: normalized });
}
