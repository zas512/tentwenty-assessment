import jwt from "jsonwebtoken";
import { Role } from "../prisma/client";

const ACCESS_SECRET = process.env.JWT_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

if (!ACCESS_SECRET || !REFRESH_SECRET) {
  throw new Error("JWT secrets are not defined in environment variables");
}

export const signAccessToken = (payload: { id: string; role: Role }) =>
  jwt.sign(payload, ACCESS_SECRET, { expiresIn: "1d" });

export const signRefreshToken = (payload: { id: string }) =>
  jwt.sign(payload, REFRESH_SECRET, { expiresIn: "7d" });

export const verifyAccessToken = (token: string) =>
  jwt.verify(token, ACCESS_SECRET) as { id: string; role: Role };

export const verifyRefreshToken = (token: string) =>
  jwt.verify(token, REFRESH_SECRET) as { id: string };
