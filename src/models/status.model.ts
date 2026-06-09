import { Schema, model, Document } from "mongoose";

export interface IStatus extends Document {
  deviceId: string;
  online: boolean;
  lastSeen: Date;
  metrics: any;
  filter: any;
  errorCodes: string[];
}

const StatusSchema = new Schema<IStatus>({
  deviceId: { type: String, required: true, unique: true },
  online: { type: Boolean, default: false },
  lastSeen: { type: Date, default: Date.now },
  metrics: Object,
  filter: Object,
  errorCodes: [String],
}, { timestamps: true });

export const StatusModel = model<IStatus>("Status", StatusSchema, "status");
