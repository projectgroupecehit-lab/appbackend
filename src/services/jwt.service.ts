import jwt, { SignOptions } from "jsonwebtoken";
import { config } from "../config";

export function signAccessToken(payload: object) {
  const options: SignOptions = { expiresIn: config.accessExpiresIn as any };
  return jwt.sign(payload, config.jwtAccessSecret as string, options);
}

export function signRefreshToken(payload: object) {
  const options: SignOptions = { expiresIn: config.refreshExpiresIn as any };
  return jwt.sign(payload, config.jwtRefreshSecret as string, options);
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, config.jwtAccessSecret);
}

export function verifyRefreshToken(token: string) {
  return jwt.verify(token, config.jwtRefreshSecret);
}
