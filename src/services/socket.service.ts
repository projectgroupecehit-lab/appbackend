import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { logger } from "../utils/logger";

export let io: Server;

export function initSocket(server: HttpServer) {
  io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] },
  });

  io.on("connection", (socket: Socket) => {
    logger.info("socket connected: " + socket.id);
    socket.on("joinDevice", (deviceId: string) => {
      socket.join(`device:${deviceId}`);
    });

    socket.on("leaveDevice", (deviceId: string) => {
      socket.leave(`device:${deviceId}`);
    });

    socket.on("disconnect", () => {
      logger.info("socket disconnected: " + socket.id);
    });
  });

  return io;
}
