import { Schema, model, Document } from "mongoose";

/**
 * User document interface
 */
export interface IUser extends Document {
  email: string;
  passwordHash?: string;
  provider: 'local' | 'google';
  roles: string[];
  profile?: {
    name?: string;
    phone?: string;
    address?: string;
    avatar?: string;
  };
  deviceId?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * User schema definition
 */
const UserSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
    passwordHash: {
      type: String,
      required: false,
    },
    provider: {
      type: String,
      required: true,
      enum: ['local', 'google'],
      default: 'local',
    },
    roles: {
      type: [String],
      default: ["user"],
      enum: ["user", "admin", "moderator"],
    },
    profile: {
      name: {
        type: String,
        trim: true,
      },
      phone: {
        type: String,
        trim: true,
      },
      address: {
        type: String,
        trim: true,
      },
      avatar: {
        type: String,
      },
    },
    deviceId: {
      type: String,
      unique: true,
      sparse: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

export const UserModel = model<IUser>("User", UserSchema, "users");
