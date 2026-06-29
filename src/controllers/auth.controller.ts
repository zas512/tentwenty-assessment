import { Request, Response } from "express";
import bcrypt from "bcrypt";
import prisma from "../config/prisma";
import { Role } from "../prisma/client";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken
} from "../utils/jwt";

type AuthenticatedRequest = Request & {
  user: {
    id: string;
    role: Role;
  };
};

const cookieOptions = (days: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  maxAge: days * 24 * 60 * 60 * 1000
});

const toGuestIdentity = () => {
  const stamp = Date.now();
  const nonce = Math.random().toString(36).slice(2, 8);
  return {
    email: `guest_${stamp}_${nonce}@guest.local`,
    username: `guest_${stamp}_${nonce}`
  };
};

export const register = async (req: Request, res: Response) => {
  const { email, username, password } = req.body;
  if (!email || !username || !password) {
    res
      .status(400)
      .json({ success: false, message: "All fields are required" });
    return;
  }
  const exists = await prisma.user.findFirst({
    where: { OR: [{ email }, { username }] }
  });
  if (exists) {
    res
      .status(409)
      .json({ success: false, message: "Email or username already taken" });
    return;
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email, username, passwordHash },
    select: { id: true, email: true, username: true, role: true }
  });
  res.status(201).json({ success: true, data: user });
};

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res
      .status(400)
      .json({ success: false, message: "All fields are required" });
    return;
  }
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    res.status(401).json({ success: false, message: "Invalid credentials" });
    return;
  }
  const accessToken = signAccessToken({ id: user.id, role: user.role });
  const refreshToken = signRefreshToken({ id: user.id });

  res.cookie("accessToken", accessToken, cookieOptions(1));
  res.cookie("refreshToken", refreshToken, cookieOptions(7));
  res.json({
    success: true,
    data: { id: user.id, email: user.email, role: user.role }
  });
};

export const loginGuest = async (_req: Request, res: Response) => {
  const { email, username } = toGuestIdentity();
  const passwordHash = await bcrypt.hash(`${email}:${username}`, 10);

  const guest = await prisma.user.create({
    data: {
      email,
      username,
      passwordHash,
      role: Role.GUEST
    },
    select: { id: true, email: true, username: true, role: true }
  });

  const accessToken = signAccessToken({ id: guest.id, role: guest.role });
  const refreshToken = signRefreshToken({ id: guest.id });

  res.cookie("accessToken", accessToken, cookieOptions(1));
  res.cookie("refreshToken", refreshToken, cookieOptions(7));
  res.status(201).json({ success: true, data: guest });
};

export const refresh = async (req: Request, res: Response) => {
  const token = req.cookies?.refreshToken;
  if (!token) {
    res.status(401).json({ success: false, message: "No refresh token" });
    return;
  }
  try {
    const { id } = verifyRefreshToken(token);
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      res.status(401).json({ success: false, message: "User not found" });
      return;
    }
    const accessToken = signAccessToken({ id: user.id, role: user.role });
    res.cookie("accessToken", accessToken, cookieOptions(1));
    res.json({
      success: true,
      data: { id: user.id, email: user.email, role: user.role }
    });
  } catch {
    res
      .status(401)
      .json({ success: false, message: "Invalid or expired refresh token" });
  }
};

export const logout = (req: Request, res: Response) => {
  res.clearCookie("accessToken");
  res.clearCookie("refreshToken");
  res.json({ success: true, message: "Logged out" });
};

export const me = async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const user = await prisma.user.findUnique({
    where: { id: authReq.user.id },
    select: {
      id: true,
      email: true,
      username: true,
      role: true,
      createdAt: true
    }
  });
  res.json({ success: true, data: user });
};
