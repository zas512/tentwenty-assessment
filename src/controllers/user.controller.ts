import { Request, Response } from "express";
import prisma from "../config/prisma";
import { Role } from "../prisma/client";

// GET /users — admin only
export const getAllUsers = async (req: Request, res: Response) => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      username: true,
      role: true,
      createdAt: true
    }
  });
  res.json({ success: true, data: users });
};

// PATCH /users/:id/role — admin only
export const updateUserRole = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { role } = req.body;

  if (!Object.values(Role).includes(role)) {
    res.status(400).json({ success: false, message: "Invalid role" });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    res.status(404).json({ success: false, message: "User not found" });
    return;
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { role },
    select: { id: true, email: true, username: true, role: true }
  });

  res.json({ success: true, data: updated });
};

// GET /users/me/history — full participation history
export const getMyHistory = async (req: Request, res: Response) => {
  const participations = await prisma.participation.findMany({
    where: { userId: req.user!.id },
    include: {
      contest: {
        select: {
          id: true,
          title: true,
          description: true,
          startsAt: true,
          endsAt: true,
          prizeTitle: true
        }
      }
    },
    orderBy: { startedAt: "desc" }
  });

  res.json({ success: true, data: participations });
};

// GET /users/me/history/inprogress — in progress only
export const getInProgressContests = async (req: Request, res: Response) => {
  const participations = await prisma.participation.findMany({
    where: { userId: req.user!.id, status: "IN_PROGRESS" },
    include: {
      contest: {
        select: {
          id: true,
          title: true,
          description: true,
          startsAt: true,
          endsAt: true
        }
      }
    },
    orderBy: { startedAt: "desc" }
  });

  res.json({ success: true, data: participations });
};

// GET /users/me/prizes — prizes won
export const getMyPrizes = async (req: Request, res: Response) => {
  const prizes = await prisma.prizeAwarded.findMany({
    where: { userId: req.user!.id },
    include: {
      contest: {
        select: { id: true, title: true }
      }
    },
    orderBy: { awardedAt: "desc" }
  });

  res.json({ success: true, data: prizes });
};
