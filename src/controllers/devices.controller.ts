import { Request, Response } from "express";
import { DeviceModel } from "../models/device.model";
import { normalizeTempReading, TempReadingModel } from "../models/temp-reading.model";
import { logger } from "../utils/logger";
import crypto from "crypto";

export async function claimDevice(req: Request, res: Response) {
  const { deviceId, claimCode } = req.body;
  const userId = (req as any).user._id;

  if (!deviceId || !claimCode) return res.status(400).json({ message: "deviceId & claimCode required" });

  const device = await DeviceModel.findOne({ deviceId });
  if (!device) return res.status(404).json({ message: "Device not found" });

  // For the scaffold assume claimCodeHash is stored in device.provisioning.claimCodeHash as sha256
  const givenHash = crypto.createHash("sha256").update(claimCode).digest("hex");
  if (!device.provisioning || device.provisioning.claimCodeHash !== givenHash) {
    return res.status(403).json({ message: "Invalid claim code" });
  }

  device.ownerUserId = userId;
  device.provisioning.claimed = true;
  device.provisioning.claimCodeHash = undefined;
  await device.save();

  res.json({ ok: true, device });
}

export async function listDevices(req: Request, res: Response) {
  const userId = (req as any).user._id;
  const devices = await DeviceModel.find({
    $or: [{ ownerUserId: userId }, { "members.userId": userId }],
  });
  res.json({ devices });
}

/**
 * Get device status with latest sensor parameters
 * Returns: status, lastSeen, and all latest sensor values
 */
export async function getDeviceStatus(req: Request, res: Response) {
  try {
    const { deviceId } = req.params;
    
    if (!deviceId) {
      return res.status(400).json({ success: false, message: "deviceId is required" });
    }

    const latestReading = await TempReadingModel.findOne({ device_id: deviceId }).sort({ createdAt: -1 });
    
    if (!latestReading) {
      return res.status(404).json({ success: false, message: "No data available for this device" });
    }

    const latest = normalizeTempReading(latestReading);
    const lastSeen = latest?.timestamp;
    const ageMs = lastSeen ? Date.now() - new Date(lastSeen).getTime() : Number.POSITIVE_INFINITY;
    const status = ageMs <= 10 * 60 * 1000 ? "online" : "offline";

    res.status(200).json({
      success: true,
      data: {
        deviceId,
        name: "Smart Water Monitor",
        status,
        lastSeen,
        latest,
      }
    });
  } catch (error) {
    logger.error("Error getting device status:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

/**
 * Get latest sensor reading for a device
 * Fast endpoint for dashboard real-time display
 */
export async function getLatestReading(req: Request, res: Response) {
  try {
    const { deviceId } = req.params;
    
    if (!deviceId) {
      return res.status(400).json({ success: false, message: "deviceId is required" });
    }

    const latestReading = await TempReadingModel.findOne({ device_id: deviceId }).sort({ createdAt: -1 });
    
    if (!latestReading) {
      return res.status(404).json({ success: false, message: "No data available for this device" });
    }

    const latest = normalizeTempReading(latestReading);

    res.status(200).json({
      success: true,
      data: {
        deviceId,
        timestamp: latest?.timestamp,
        parameters: latest,
      }
    });
  } catch (error) {
    logger.error("Error getting latest reading:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
}
