import { Router } from "express";
import * as auth from "../controllers/auth.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post("/register", auth.register);

/**
 * POST /api/auth/login
 * Authenticate user and get tokens
 */
router.post("/login", auth.login);

/**
 * POST /api/auth/google
 * Authenticate user with Google and get tokens
 */
router.post("/google", auth.googleLogin);

/**
 * POST /api/auth/check-user
 * Check if user exists by email
 */
router.post("/check-user", auth.checkUserExists);

/**
 * POST /api/auth/complete-registration
 * Complete registration with additional profile information
 */
router.post("/complete-registration", auth.completeGoogleRegistration);

/**
 * POST /api/auth/refresh
 * Get new access token using refresh token
 */
router.post("/refresh", auth.refresh);

/**
 * POST /api/auth/logout
 * Revoke refresh token
 */
router.post("/logout", auth.logout);

export default router;
