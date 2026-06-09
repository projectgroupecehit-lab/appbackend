import mongoose from "mongoose";
import { logger } from "../utils/logger";

export async function connectDB(uri: string) {
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri);
  logger.info("MongoDB connected");
}
