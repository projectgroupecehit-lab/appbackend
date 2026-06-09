import http from "http";
import { createApp } from "./app";
import { connectDB } from "./db/mongoose";
import { config, validateRequiredConfig } from "./config";
import { initSocket } from "./services/socket.service";
import { initMqtt } from "./services/mqtt.service";
import { loadMLArtifacts } from "./services/analysis.service";
import { logger } from "./utils/logger";

async function main() {
  validateRequiredConfig();

  await connectDB(config.mongoUri);

  // Load ML model artifacts
  await loadMLArtifacts();

  const app = createApp();
  const server = http.createServer(app);

  initSocket(server);
  if (config.mqttEnabled) {
    initMqtt();
  } else {
    logger.info("MQTT disabled. Set MQTT_ENABLED=true and MQTT_URL to enable telemetry ingestion.");
  }

  server.listen(config.port, () => {
    logger.info(`Server running on port ${config.port}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
