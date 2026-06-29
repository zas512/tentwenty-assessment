import { Request, Response } from "express";
import prisma from "../config/prisma";
import {
  ContestAccess,
  ContestStatus,
  QuestionType,
  Role
} from "../prisma/client";

export const addQuestion = async (req: Request, res: Response) => {
  const { id: contestId } = req.params;
  const { text, type, order, points, options } = req.body;
  if (
    !text ||
    !type ||
    !order ||
    !options ||
    !Array.isArray(options) ||
    options.length === 0
  ) {
    res
      .status(400)
      .json({ success: false, message: "Missing required fields" });
    return;
  }
  if (!Object.values(QuestionType).includes(type)) {
    res.status(400).json({ success: false, message: "Invalid question type" });
    return;
  }
  const contest = await prisma.contest.findUnique({ where: { id: contestId } });
  if (!contest) {
    res.status(404).json({ success: false, message: "Contest not found" });
    return;
  }
  if (type === QuestionType.TRUE_FALSE && options.length !== 2) {
    res.status(400).json({
      success: false,
      message: "True/False questions must have exactly 2 options"
    });
    return;
  }
  if (
    type === QuestionType.SINGLE_SELECT &&
    options.filter((o: any) => o.isCorrect).length !== 1
  ) {
    res.status(400).json({
      success: false,
      message: "Single select questions must have exactly 1 correct option"
    });
    return;
  }

  if (
    type === QuestionType.MULTI_SELECT &&
    options.filter((o: any) => o.isCorrect).length === 0
  ) {
    res.status(400).json({
      success: false,
      message: "Multi select questions must have at least 1 correct option"
    });
    return;
  }

  const existing = await prisma.question.findUnique({
    where: { contestId_order: { contestId, order } }
  });
  if (existing) {
    res.status(409).json({
      success: false,
      message: `A question with order ${order} already exists`
    });
    return;
  }

  const question = await prisma.question.create({
    data: {
      contestId,
      text,
      type,
      order,
      points: points ?? 1,
      options: {
        create: options.map(
          (o: { text: string; isCorrect: boolean; order: number }) => ({
            text: o.text,
            isCorrect: o.isCorrect,
            order: o.order
          })
        )
      }
    },
    include: { options: { orderBy: { order: "asc" } } }
  });
  res.status(201).json({ success: true, data: question });
};

export const getQuestions = async (req: Request, res: Response) => {
  const { id: contestId } = req.params;
  const role = req.user!.role;
  const contest = await prisma.contest.findUnique({ where: { id: contestId } });
  if (!contest) {
    res.status(404).json({ success: false, message: "Contest not found" });
    return;
  }
  if (contest.status === ContestStatus.DRAFT && role !== Role.ADMIN) {
    res.status(403).json({ success: false, message: "Forbidden" });
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
  const questions = await prisma.question.findMany({
    where: { contestId },
    orderBy: { order: "asc" },
    include: {
      options: {
        orderBy: { order: "asc" },
        select: { id: true, text: true, order: true }
      }
    }
  });
  res.json({ success: true, data: questions });
};

export const updateQuestion = async (req: Request, res: Response) => {
  const { questionId } = req.params;
  const { text, order, points, options } = req.body;
  const question = await prisma.question.findUnique({
    where: { id: questionId }
  });
  if (!question) {
    res.status(404).json({ success: false, message: "Question not found" });
    return;
  }
  if (options && Array.isArray(options)) {
    if (question.type === QuestionType.TRUE_FALSE && options.length !== 2) {
      res.status(400).json({
        success: false,
        message: "True/False questions must have exactly 2 options"
      });
      return;
    }
    if (
      question.type === QuestionType.SINGLE_SELECT &&
      options.filter((o: any) => o.isCorrect).length !== 1
    ) {
      res.status(400).json({
        success: false,
        message: "Single select questions must have exactly 1 correct option"
      });
      return;
    }
    if (
      question.type === QuestionType.MULTI_SELECT &&
      options.filter((o: any) => o.isCorrect).length === 0
    ) {
      res.status(400).json({
        success: false,
        message: "Multi select questions must have at least 1 correct option"
      });
      return;
    }
  }

  const updated = await prisma.$transaction(async (tx: any) => {
    if (options && Array.isArray(options)) {
      await tx.option.deleteMany({ where: { questionId } });
      await tx.option.createMany({
        data: options.map(
          (o: { text: string; isCorrect: boolean; order: number }) => ({
            questionId,
            text: o.text,
            isCorrect: o.isCorrect,
            order: o.order
          })
        )
      });
    }
    return tx.question.update({
      where: { id: questionId },
      data: {
        ...(text && { text }),
        ...(order && { order }),
        ...(points && { points })
      },
      include: { options: { orderBy: { order: "asc" } } }
    });
  });
  res.json({ success: true, data: updated });
};

export const deleteQuestion = async (req: Request, res: Response) => {
  const { questionId } = req.params;
  const question = await prisma.question.findUnique({
    where: { id: questionId }
  });
  if (!question) {
    res.status(404).json({ success: false, message: "Question not found" });
    return;
  }
  await prisma.question.delete({ where: { id: questionId } });
  res.json({ success: true, message: "Question deleted" });
};
