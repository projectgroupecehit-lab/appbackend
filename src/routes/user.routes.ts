import { Router } from "express";
import * as user from "../controllers/user.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

/**
 * GET /api/user/:id
 * Get user by ID
 */
router.get("/:id", requireAuth, user.getUser);

export default router;
