import { Schema, model, Document } from "mongoose";

export const PRIMARY_DEVICE_ID = "NODE8266_01";

export interface ITempReading extends Document {
  device_id: string;
  temperature?: number;
  ph?: number;
  tds?: number;
  do?: number;
  ec?: number;
  turbidity?: number;
  createdAt: Date;
  updatedAt: Date;
}

const TempReadingSchema = new Schema<ITempReading>(
  {
    device_id: { type: String, required: true, index: true },
    temperature: Number,
    ph: Number,
    tds: Number,
    do: Number,
    ec: Number,
    turbidity: Number,
  },
  { timestamps: true, collection: "temps" }
);

export const TempReadingModel = model<ITempReading>("TempReading", TempReadingSchema, "temps");

export function normalizeTempReading(reading: ITempReading | null) {
  if (!reading) return null;

  const plain = typeof reading.toObject === "function" ? reading.toObject() : reading;
  const timestamp = plain.createdAt || plain.updatedAt;

  return {
    _id: plain._id,
    deviceId: plain.device_id,
    device_id: plain.device_id,
    ts: timestamp,
    timestamp,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
    temperature: plain.temperature,
    tempC: plain.temperature,
    ph: plain.ph,
    tds: plain.tds,
    do: plain.do,
    dissolved_oxygen: plain.do,
    ec: plain.ec,
    conductivity: plain.ec,
    turbidity: plain.turbidity,
  };
}
