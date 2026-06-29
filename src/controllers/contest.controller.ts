import { Request, Response } from "express";
import prisma from "../config/prisma";
import { ContestAccess, ContestStatus, Role } from "../prisma/client";

export const createContest = async (req: Request, res: Response) => {
  const {
    title,
    description,
    access,
    startsAt,
    endsAt,
    prizeTitle,
    prizeDesc
  } = req.body;
  if (!title || !description || !startsAt || !endsAt || !prizeTitle) {
    res
      .status(400)
      .json({ success: false, message: "Missing required fields" });
    return;
  }
  if (new Date(startsAt) >= new Date(endsAt)) {
    res
      .status(400)
      .json({ success: false, message: "startsAt must be before endsAt" });
    return;
  }
  const contest = await prisma.contest.create({
    data: {
      title,
      description,
      access: access ?? ContestAccess.NORMAL,
      startsAt: new Date(startsAt),
      endsAt: new Date(endsAt),
      prizeTitle,
      prizeDesc
    }
  });
  res.status(201).json({ success: true, data: contest });
};

export const getContests = async (req: Request, res: Response) => {
  const role = req.user?.role;
  const accessFilter =
    role === Role.ADMIN || role === Role.VIP
      ? undefined
      : { access: ContestAccess.NORMAL };
  const contests = await prisma.contest.findMany({
    where: {
      ...accessFilter,
      status: { not: ContestStatus.DRAFT }
    },
    select: {
      id: true,
      title: true,
      description: true,
      access: true,
      status: true,
      startsAt: true,
      endsAt: true,
      prizeTitle: true,
      prizeDesc: true,
      createdAt: true,
      _count: { select: { questions: true, participations: true } }
    },
    orderBy: { startsAt: "desc" }
  });
  res.json({ success: true, data: contests });
};

export const getContest = async (req: Request, res: Response) => {
  const { id } = req.params;
  const role = req.user?.role;
  const contest = await prisma.contest.findUnique({
    where: { id },
    include: {
      questions: {
        orderBy: { order: "asc" },
        include: {
          options: {
            orderBy: { order: "asc" },
            select: { id: true, text: true, order: true }
          }
        }
      }
    }
  });
  if (!contest) {
    res.status(404).json({ success: false, message: "Contest not found" });
    return;
  }
  if (
    contest.access === ContestAccess.VIP &&
    role !== Role.ADMIN &&
    role !== Role.VIP
  ) {
    res
      .status(403)
      .json({ success: false, message: "This contest is for VIP users only" });
    return;
  }
  res.json({ success: true, data: contest });
};

export const updateContest = async (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    title,
    description,
    access,
    status,
    startsAt,
    endsAt,
    prizeTitle,
    prizeDesc
  } = req.body;
  const contest = await prisma.contest.findUnique({ where: { id } });
  if (!contest) {
    res.status(404).json({ success: false, message: "Contest not found" });
    return;
  }
  if (startsAt && endsAt && new Date(startsAt) >= new Date(endsAt)) {
    res
      .status(400)
      .json({ success: false, message: "startsAt must be before endsAt" });
    return;
  }
  const updated = await prisma.contest.update({
    where: { id },
    data: {
      ...(title && { title }),
      ...(description && { description }),
      ...(access && { access }),
      ...(status && { status }),
      ...(startsAt && { startsAt: new Date(startsAt) }),
      ...(endsAt && { endsAt: new Date(endsAt) }),
      ...(prizeTitle && { prizeTitle }),
      ...(prizeDesc && { prizeDesc })
    }
  });
  res.json({ success: true, data: updated });
};

export const deleteContest = async (req: Request, res: Response) => {
  const { id } = req.params;
  const contest = await prisma.contest.findUnique({ where: { id } });
  if (!contest) {
    res.status(404).json({ success: false, message: "Contest not found" });
    return;
  }
  await prisma.contest.delete({ where: { id } });
  res.json({ success: true, message: "Contest deleted" });
};
