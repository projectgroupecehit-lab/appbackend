import { Request, Response } from 'express';
import { normalizeTempReading, TempReadingModel } from '../models/temp-reading.model';
import { logger } from '../utils/logger';

export const getLatestTelemetry = async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const latestTelemetry = await TempReadingModel.findOne({ device_id: deviceId }).sort({ createdAt: -1 });
    if (!latestTelemetry) {
      return res.status(404).json({ success: false, message: 'No telemetry data found for this device.' });
    }
    res.status(200).json({ success: true, data: normalizeTempReading(latestTelemetry) });
  } catch (error) {
    logger.error('Error getting latest telemetry:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getTelemetryHistory = async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const { hours = 24 } = req.query;
    const since = new Date(Date.now() - Number(hours) * 60 * 60 * 1000);
    const telemetryHistory = await TempReadingModel.find({
      device_id: deviceId,
      createdAt: { $gte: since },
    }).sort({ createdAt: 1 });
    res.status(200).json({
      success: true,
      data: telemetryHistory.map(normalizeTempReading),
    });
  } catch (error) {
    logger.error('Error getting telemetry history:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
