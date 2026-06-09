import { Request, Response } from "express";
import { UserModel } from "../models/user.model";
import { DeviceModel } from "../models/device.model";

/**
 * Get user by ID
 * @param {string} id - User ID
 * @returns {object} User details
 */
export async function getUser(req: Request, res: Response) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    const user = await UserModel.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const device = await DeviceModel.findOne({ ownerUserId: user._id });

    return res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          email: user.email,
          name: user.profile?.name,
          phone: user.profile?.phone,
          address: user.profile?.address,
          deviceId: device?.deviceId,
        },
      },
    });
  } catch (error) {
    console.error("Get user error:", error);
    return res.status(500).json({
      success: false,
      message: "Get user failed",
    });
  }
}
