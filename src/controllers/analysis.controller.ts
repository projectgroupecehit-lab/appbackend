import { Request, Response } from 'express';
import { analyzeDeviceWaterQuality } from '../services/analysis.service';
import { logger } from '../utils/logger';

/**
 * Get water quality analysis for a device
 * Includes: WHO status, ML prediction, confidence, and Gemini insights
 */
export const getDeviceAnalysis = async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;

    if (!deviceId) {
      return res.status(400).json({ 
        success: false, 
        message: 'deviceId is required' 
      });
    }

    const analysis = await analyzeDeviceWaterQuality(deviceId);

    res.status(200).json({ 
      success: true, 
      data: analysis 
    });
  } catch (error: any) {
    logger.error('Error getting device analysis:', error);
    
    const statusCode = error.message?.includes('No telemetry') ? 404 : 500;
    const message = error.message || 'Failed to analyze device water quality';

    res.status(statusCode).json({ 
      success: false, 
      message 
    });
  }
};
