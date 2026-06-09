import { Schema, model, Document } from "mongoose";

export interface IDevice extends Document {
  deviceId: string;
  name?: string;
  ownerUserId?: string;
  members?: { userId: string; role: string }[];
  firmwareVersion?: string;
  provisioning?: { claimed?: boolean; claimCodeHash?: string };
  location?: { label?: string; lat?: number; lng?: number };
  status?: "online" | "offline";
  lastSeen?: Date;
  latest?: {
    ph?: number;
    tds?: number;
    turbidity?: number;
    temperature?: number;
    conductivity?: number;
    dissolved_oxygen?: number;
    flowLpm?: number;
    tankPct?: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const DeviceSchema = new Schema<IDevice>({
  deviceId: { type: String, required: true, unique: true },
  name: String,
  ownerUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
  members: [{ userId: { type: Schema.Types.ObjectId, ref: "User" }, role: String }],
  firmwareVersion: String,
  provisioning: {
    claimed: { type: Boolean, default: false },
    claimCodeHash: String,
  },
  location: {
    label: String,
    lat: Number,
    lng: Number,
  },
  status: {
    type: String,
    enum: ["online", "offline"],
    default: "offline"
  },
  lastSeen: {
    type: Date,
    default: null
  },
  latest: {
    ph: Number,
    tds: Number,
    turbidity: Number,
    temperature: Number,
    conductivity: Number,
    dissolved_oxygen: Number,
    flowLpm: Number,
    tankPct: Number
  }
}, { timestamps: true });

export const DeviceModel = model<IDevice>("Device", DeviceSchema, "devices");
