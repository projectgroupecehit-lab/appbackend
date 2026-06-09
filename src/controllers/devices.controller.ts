import { Request, Response } from "express";
import { DeviceModel } from "../models/device.model";
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

    const device = await DeviceModel.findOne({ deviceId }).select("deviceId name status lastSeen latest location");
    
    if (!device) {
      return res.status(404).json({ success: false, message: "Device not found" });
    }

    res.status(200).json({
      success: true,
      data: {
        deviceId: device.deviceId,
        name: device.name,
        status: device.status || "offline",
        lastSeen: device.lastSeen,
        location: device.location,
        latest: device.latest || {},
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

    const device = await DeviceModel.findOne({ deviceId }).select("deviceId status lastSeen latest");
    
    if (!device || !device.latest) {
      return res.status(404).json({ success: false, message: "No data available for this device" });
    }

    res.status(200).json({
      success: true,
      data: {
        deviceId: device.deviceId,
        status: device.status || "offline",
        timestamp: device.lastSeen,
        parameters: device.latest,
      }
    });
  } catch (error) {
    logger.error("Error getting latest reading:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
}
