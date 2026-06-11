import { Request, Response } from "express";
import { StatusModel } from "../models/status.model";
import { normalizeTempReading, TempReadingModel } from "../models/temp-reading.model";
import { config } from "../config";
import { syncGoogleSheetToMongo } from "../services/google-sheet-sync.service";
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

export async function syncGoogleSheet(req: Request, res: Response) {
  const expectedSecret = config.googleSheet.syncSecret;
  const body = req.body || {};

  if (expectedSecret && req.header("x-sync-secret") !== expectedSecret) {
    return res.status(401).json({ ok: false, message: "Invalid sync secret" });
  }

  const sheetId = String(body.sheetId || req.query.sheetId || config.googleSheet.id);
  const gid = String(body.gid || req.query.gid || config.googleSheet.gid);
  const deviceId = String(body.deviceId || req.query.deviceId || config.googleSheet.deviceId || "");
  const limitValue = body.limit || req.query.limit;
  const limit = limitValue ? Number(limitValue) : undefined;

  if (!sheetId) {
    return res.status(400).json({ ok: false, message: "GOOGLE_SHEET_ID or sheetId is required" });
  }

  const result = await syncGoogleSheetToMongo({
    sheetId,
    gid,
    deviceId: deviceId || undefined,
    limit: Number.isFinite(limit) ? limit : undefined,
  });

  res.json(result);
}
