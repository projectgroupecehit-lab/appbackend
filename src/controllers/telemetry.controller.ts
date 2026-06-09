import { Request, Response } from 'express';
import { TelemetryModel } from '../models/telemetry.model';
import { logger } from '../utils/logger';

export const getLatestTelemetry = async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const latestTelemetry = await TelemetryModel.findOne({ deviceId }).sort({ ts: -1 });
    if (!latestTelemetry) {
      return res.status(404).json({ success: false, message: 'No telemetry data found for this device.' });
    }
    res.status(200).json({ success: true, data: latestTelemetry });
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
    const telemetryHistory = await TelemetryModel.find({
      deviceId,
      ts: { $gte: since },
    }).sort({ ts: 1 });
    res.status(200).json({ success: true, data: telemetryHistory });
  } catch (error) {
    logger.error('Error getting telemetry history:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
