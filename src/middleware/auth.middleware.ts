import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { UserModel } from "../models/user.model";

/**
 * Extended Request with user context
 */
export interface AuthRequest extends Request {
  user?: any;
}

/**
 * Middleware to verify JWT token and attach user to request
 * Expected header: Authorization: Bearer <token>
 */
export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "Missing authorization header",
      });
    }

    // Extract token from "Bearer <token>"
    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") {
      return res.status(401).json({
        success: false,
        message: "Invalid authorization header format",
      });
    }

    const token = parts[1];

    // Verify token
    const payload = jwt.verify(token, config.jwtAccessSecret) as any;
    
    // Get user from database
    const user = await UserModel.findById(payload.sub).select("-passwordHash");
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (error: any) {
    console.error("Auth middleware error:", error.message);
    
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token expired",
      });
    }

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid token",
      });
    }

    return res.status(401).json({
      success: false,
      message: "Authentication failed",
    });
  }
}

/**
 * Middleware to check if user has required role
 */
export function requireRole(requiredRole: string) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    if (!req.user.roles || !req.user.roles.includes(requiredRole)) {
      return res.status(403).json({
        success: false,
        message: "Insufficient permissions",
      });
    }

    next();
  };
}
