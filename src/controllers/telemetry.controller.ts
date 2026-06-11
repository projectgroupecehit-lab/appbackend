import { Request, Response } from 'express';
import { normalizeTempReading, TempReadingModel } from '../models/temp-reading.model';
import { logger } from '../utils/logger';

const validReadingFilter = {
  $or: [
    { ph: { $type: 'number' } },
    { tds: { $type: 'number' } },
    { turbidity: { $type: 'number' } },
    { temperature: { $type: 'number' } },
    { ec: { $type: 'number' } },
    { do: { $type: 'number' } },
  ],
};

export const getLatestTelemetry = async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const latestTelemetry = await TempReadingModel.findOne({
      device_id: deviceId,
      ...validReadingFilter,
    }).sort({ createdAt: -1 });
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
    const requestedHours = Number(hours);
    const windowHours = Number.isFinite(requestedHours) && requestedHours > 0 ? requestedHours : 24;

    const latestTelemetry = await TempReadingModel.findOne({
      device_id: deviceId,
      ...validReadingFilter,
    }).sort({ createdAt: -1 });

    if (!latestTelemetry) {
      return res.status(404).json({ success: false, message: 'No telemetry data found for this device.' });
    }

    const latestTimestamp = latestTelemetry.createdAt;
    const since = new Date(latestTimestamp.getTime() - windowHours * 60 * 60 * 1000);
    const telemetryHistory = await TempReadingModel.find({
      device_id: deviceId,
      createdAt: { $gte: since, $lte: latestTimestamp },
      ...validReadingFilter,
    }).sort({ createdAt: 1 });

    res.status(200).json({
      success: true,
      data: telemetryHistory.map(normalizeTempReading),
      meta: {
        deviceId,
        hours: windowHours,
        from: since,
        to: latestTimestamp,
        count: telemetryHistory.length,
      },
    });
  } catch (error) {
    logger.error('Error getting telemetry history:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
