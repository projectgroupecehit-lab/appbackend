import { Router } from 'express';
import { getDeviceAnalysis } from '../controllers/analysis.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

/**
 * @swagger
 * /analysis/{deviceId}:
 *   get:
 *     summary: Get AI water quality analysis for a device
 *     tags: [Analysis]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: deviceId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Water quality analysis with WHO status, ML prediction, and AI insights
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     who_status:
 *                       type: string
 *                       example: "Safe (Potable)"
 *                     ml_prediction:
 *                       type: string
 *                       example: "Potable Water"
 *                     ml_probability:
 *                       type: number
 *                       example: 0.95
 *                     ai_insights:
 *                       type: string
 *       404:
 *         description: No telemetry data found for device
 *       500:
 *         description: Server error
 */
router.get('/:deviceId', requireAuth, getDeviceAnalysis);

export default router;
