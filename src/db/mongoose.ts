import mongoose from "mongoose";
import { logger } from "../utils/logger";

export async function connectDB(uri: string, dbName?: string) {
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri, dbName ? { dbName } : undefined);
  logger.info(`MongoDB connected${dbName ? ` to database ${dbName}` : ""}`);
}
