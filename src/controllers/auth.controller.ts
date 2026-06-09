import { Request, Response } from "express";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { UserModel } from "../models/user.model";
import { DeviceModel } from "../models/device.model";
import { RefreshTokenModel } from "../models/refreshToken.model";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../services/jwt.service";
import { config } from "../config";
import { OAuth2Client } from "google-auth-library";

const client = new OAuth2Client();

/**
 * Registers a new user
 * @body {string} email - User email (unique)
 * @body {string} password - User password (will be hashed)
 * @body {string} name - User display name
 * @returns {object} User info, access token, refresh token, and device ID
 */
export async function register(req: Request, res: Response) {
  try {
    const { email, password, name } = req.body;

    // Validate input
    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        message: "Email, password, and name are required",
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format",
      });
    }

    // Validate password strength
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }

    // Check if user already exists
    const existingUser = await UserModel.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Email already registered",
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const user = await UserModel.create({
      email: email.toLowerCase(),
      passwordHash,
      profile: { name: name.trim() },
      provider: 'local',
    });

    // Create initial device for user
    const deviceId = crypto.randomBytes(8).toString("hex");
    await DeviceModel.create({
      deviceId,
      ownerUserId: user._id,
      name: `${name}'s Device`,
    });

    // Generate tokens
    const accessToken = signAccessToken({ sub: user._id, roles: user.roles });
    const refreshToken = signRefreshToken({ sub: user._id });

    // Store refresh token
    await RefreshTokenModel.create({
      userId: user._id,
      token: refreshToken,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    });

    console.log(`✅ User registered: ${email}`);

    return res.status(201).json({
      success: true,
      message: "Registration successful",
      data: {
        user: {
          id: user._id,
          email: user.email,
          name: user.profile?.name,
        },
        accessToken,
        refreshToken,
        deviceId,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);
    return res.status(500).json({
      success: false,
      message: "Registration failed",
    });
  }
}

/**
 * Logs in a user
 * @body {string} email - User email
 * @body {string} password - User password
 * @returns {object} Access token and refresh token
 */
export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    // Find user
    const user = await UserModel.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Check provider
    if (user.provider !== 'local' || !user.passwordHash) {
        return res.status(401).json({
            success: false,
            message: "This account must be accessed with its original sign-in method.",
        });
    }

    // Verify password
    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Generate tokens
    const accessToken = signAccessToken({ sub: user._id, roles: user.roles });
    const refreshToken = signRefreshToken({ sub: user._id });

    // Store refresh token
    await RefreshTokenModel.create({
      userId: user._id,
      token: refreshToken,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    });

    // Find user's device
    const device = await DeviceModel.findOne({ ownerUserId: user._id });

    console.log(`✅ User logged in: ${email}`);

    return res.json({
      success: true,
      message: "Login successful",
      data: {
        user: {
          id: user._id,
          email: user.email,
          name: user.profile?.name,
        },
        accessToken,
        refreshToken,
        device,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({
      success: false,
      message: "Login failed",
    });
  }
}

/**
 * Refreshes access token
 * @body {string} refreshToken - Valid refresh token
 * @returns {object} New access token
 */
export async function refresh(req: Request, res: Response) {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: "Refresh token is required",
      });
    }

    // Verify refresh token
    const payload = verifyRefreshToken(refreshToken) as any;
    if (!payload) {
      return res.status(401).json({
        success: false,
        message: "Invalid refresh token",
      });
    }

    // Check token in database
    const tokenDoc = await RefreshTokenModel.findOne({
      token: refreshToken,
      revoked: false,
    });

    if (!tokenDoc) {
      return res.status(401).json({
        success: false,
        message: "Refresh token revoked or expired",
      });
    }

    // Get user
    const user = await UserModel.findById(payload.sub);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Generate new access token
    const newAccessToken = signAccessToken({ sub: user._id, roles: user.roles });

    console.log(`✅ Token refreshed for user: ${user.email}`);

    return res.json({
      success: true,
      message: "Token refreshed",
      data: {
        accessToken: newAccessToken,
      },
    });
  } catch (error) {
    console.error("Token refresh error:", error);
    return res.status(401).json({
      success: false,
      message: "Token refresh failed",
    });
  }
}

/**
 * Logs in or registers a user via Google ID token
 * @body {string} idToken - Google ID token
 * @returns {object} Access token and refresh token
 */
export async function googleLogin(req: Request, res: Response) {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({
        success: false,
        message: "Google ID token is required",
      });
    }

    // Verify Google ID token
    const ticket = await client.verifyIdToken({
      idToken,
      audience: config.google.webClientId,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email || !payload.name) {
      return res.status(401).json({
        success: false,
        message: "Invalid Google token",
      });
    }

    const { email, name } = payload;
    const emailLowerCase = email.toLowerCase();

    // Find or create user
    let user = await UserModel.findOne({ email: emailLowerCase });

    if (!user) {
      // Create a new user
      user = await UserModel.create({
        email: emailLowerCase,
        profile: { name },
        provider: "google",
      });

      // Create initial device for user
      const deviceId = crypto.randomBytes(8).toString("hex");
      await DeviceModel.create({
        deviceId,
        ownerUserId: user._id,
        name: `${name}'s Device`,
      });
      console.log(`✅ New user registered via Google: ${email}`);
    }

    // Generate tokens
    const accessToken = signAccessToken({ sub: user._id, roles: user.roles });
    const refreshToken = signRefreshToken({ sub: user._id });

    // Store refresh token
    await RefreshTokenModel.create({
      userId: user._id,
      token: refreshToken,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    });

    // Find user's device
    const device = await DeviceModel.findOne({ ownerUserId: user._id });

    console.log(`✅ User logged in via Google: ${email}`);

    return res.json({
      success: true,
      message: "Google login successful",
      data: {
        user: {
          id: user._id,
          email: user.email,
          name: user.profile?.name,
        },
        accessToken,
        refreshToken,
        device,
      },
    });
  } catch (error) {
    console.error("Google login error:", error);
    return res.status(500).json({
      success: false,
      message: "Google login failed",
    });
  }
}

/**
 * Logs out a user by revoking refresh token
 * @body {string} refreshToken - Refresh token to revoke
 * @returns {object} Success status
 */
export async function logout(req: Request, res: Response) {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: "Refresh token is required",
      });
    }

    // Revoke refresh token
    await RefreshTokenModel.updateOne({ token: refreshToken }, { revoked: true });

    console.log("✅ User logged out");

    return res.json({
      success: true,
      message: "Logout successful",
    });
  } catch (error) {
    console.error("Logout error:", error);
    return res.status(500).json({
      success: false,
      message: "Logout failed",
    });
  }
}

/**
 * Check if user exists by email
 * @body {string} email - User email
 * @returns {object} User exists status
 */
export async function checkUserExists(req: Request, res: Response) {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const user = await UserModel.findOne({ email: email.toLowerCase() });

    return res.json({
      success: true,
      data: {
        exists: !!user,
        user: user ? {
          id: user._id,
          email: user.email,
          name: user.profile?.name,
          phone: user.profile?.phone,
          address: user.profile?.address,
        } : null,
      },
    });
  } catch (error) {
    console.error("Check user error:", error);
    return res.status(500).json({
      success: false,
      message: "Check user failed",
    });
  }
}

/**
 * Complete registration with additional profile information
 * @body {string} idToken - Google ID token
 * @body {string} phone - User phone number
 * @body {string} address - User address
 * @returns {object} User info, access token, refresh token, and device ID
 */
export async function completeGoogleRegistration(req: Request, res: Response) {
  try {
    const { idToken, phone, address } = req.body;

    if (!idToken) {
      return res.status(400).json({
        success: false,
        message: "Google ID token is required",
      });
    }

    if (!phone || !address) {
      return res.status(400).json({
        success: false,
        message: "Phone number and address are required",
      });
    }

    // Verify Google ID token
    const ticket = await client.verifyIdToken({
      idToken,
      audience: config.google.webClientId,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email || !payload.name) {
      return res.status(401).json({
        success: false,
        message: "Invalid Google token",
      });
    }

    const { email, name } = payload;
    const emailLowerCase = email.toLowerCase();

    // Check if user already exists
    let user = await UserModel.findOne({ email: emailLowerCase });

    if (user) {
      // User already exists
      return res.status(409).json({
        success: false,
        message: "Account already exists. Please log in instead.",
        data: {
          email: user.email,
          name: user.profile?.name,
        },
      });
    }

    // Create a new user with complete profile
    user = await UserModel.create({
      email: emailLowerCase,
      profile: {
        name,
        phone: phone.trim(),
        address: address.trim(),
      },
      provider: "google",
    });

    // Create initial device for user
    const deviceId = crypto.randomBytes(8).toString("hex");
    await DeviceModel.create({
      deviceId,
      ownerUserId: user._id,
      name: `${name}'s Device`,
    });

    // Update user with deviceId
    user = await UserModel.findByIdAndUpdate(
      user._id,
      { deviceId },
      { new: true }
    );

    if (!user) {
      return res.status(500).json({
        success: false,
        message: "Failed to update user with device ID",
      });
    }

    console.log(`✅ New user registered via Google with profile: ${email}`);

    // Generate tokens
    const accessToken = signAccessToken({ sub: user._id, roles: user.roles });
    const refreshToken = signRefreshToken({ sub: user._id });

    // Store refresh token
    await RefreshTokenModel.create({
      userId: user._id,
      token: refreshToken,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    });

    return res.json({
      success: true,
      message: "Registration completed successfully",
      data: {
        user: {
          id: user._id,
          email: user.email,
          name: user.profile?.name,
          phone: user.profile?.phone,
          address: user.profile?.address,
          deviceId: user.deviceId,
        },
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    console.error("Complete registration error:", error);
    return res.status(500).json({
      success: false,
      message: "Registration completion failed",
    });
  }
}

