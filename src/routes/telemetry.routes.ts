import { Router } from 'express';
import { getLatestTelemetry, getTelemetryHistory } from '../controllers/telemetry.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

/**
 * @swagger
 * /telemetry/{deviceId}/latest:
 *   get:
 *     summary: Get the latest telemetry data for a device
 *     tags: [Telemetry]
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
 *         description: Latest telemetry data
 *       404:
 *         description: No telemetry data found
 */
router.get('/:deviceId/latest', requireAuth, getLatestTelemetry);

/**
 * @swagger
 * /telemetry/{deviceId}/history:
 *   get:
 *     summary: Get telemetry history for a device
 *     tags: [Telemetry]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: deviceId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: hours
 *         schema:
 *           type: integer
 *           default: 24
 *         description: The number of hours of history to retrieve.
 *     responses:
 *       200:
 *         description: Telemetry history data
 */
router.get('/:deviceId/history', requireAuth, getTelemetryHistory);

export default router;
