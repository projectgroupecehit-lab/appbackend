import { Schema, model, Document } from "mongoose";

export interface ITelemetry extends Document {
  deviceId: string;
  ts: Date;
  tds?: number;
  ph?: number;
  tempC?: number;
  conductivity?: number;
  turbidity?: number;
  dissolved_oxygen?: number;
  flowLpm?: number;
  tankPct?: number;
  raw?: string;
}

const TelemetrySchema = new Schema<ITelemetry>({
  deviceId: { type: String, required: true },
  ts: { type: Date, default: Date.now },
  tds: Number,
  ph: Number,
  tempC: Number,
  conductivity: Number,
  turbidity: Number,
  dissolved_oxygen: Number,
  flowLpm: Number,
  tankPct: Number,
  raw: String,
}, { timestamps: true });

export const TelemetryModel = model<ITelemetry>("Telemetry", TelemetrySchema, "telemetries");
