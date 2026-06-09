import { Request, Response } from "express";
import { TelemetryModel } from "../models/telemetry.model";
import { StatusModel } from "../models/status.model";
import { io } from "../services/socket.service"; // will export socket server

export async function ingest(req: Request, res: Response) {
  const { deviceId, ts, tds, ph, tempC, conductivity, turbidity, dissolved_oxygen, flowLpm, tankPct, raw } = req.body;
  if (!deviceId) return res.status(400).json({ message: "deviceId required" });

  const tele = await TelemetryModel.create({
    deviceId,
    ts: ts ? new Date(ts) : new Date(),
    tds,
    ph,
    tempC,
    conductivity,
    turbidity,
    dissolved_oxygen,
    flowLpm,
    tankPct,
    raw,
  });

  // update status document quickly
  await StatusModel.updateOne(
    { deviceId },
    {
      $set: {
        online: true,
        lastSeen: new Date(),
        metrics: { tds, ph, tempC, conductivity, turbidity, dissolved_oxygen, flowLpm, tankPct },
      },
    },
    { upsert: true }
  );

  // emit real-time update to room
  io.to(`device:${deviceId}`).emit("telemetry", tele);

  res.json({ ok: true });
}
