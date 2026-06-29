import { Request, Response } from "express";
import prisma from "../config/prisma";
import { ContestAccess, ContestStatus, Role } from "../prisma/client";

// POST /contests/:id/join
export const joinContest = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;
  const role = req.user!.role;

  const contest = await prisma.contest.findUnique({ where: { id } });

  if (!contest) {
    res.status(404).json({ success: false, message: "Contest not found" });
    return;
  }

  if (contest.status !== ContestStatus.ACTIVE) {
    res.status(400).json({ success: false, message: "Contest is not active" });
    return;
  }

  if (new Date() > contest.endsAt) {
    res.status(400).json({ success: false, message: "Contest has ended" });
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

  const existing = await prisma.participation.findUnique({
    where: { userId_contestId: { userId, contestId: id } }
  });

  if (existing) {
    res
      .status(409)
      .json({ success: false, message: "Already joined this contest" });
    return;
  }

  const participation = await prisma.participation.create({
    data: { userId, contestId: id }
  });

  res.status(201).json({ success: true, data: participation });
};

// POST /contests/:id/submit
export const submitContest = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;
  const { answers } = req.body;
  // answers: [{ questionId: string, optionIds: string[] }]

  if (!answers || !Array.isArray(answers) || answers.length === 0) {
    res.status(400).json({ success: false, message: "Answers are required" });
    return;
  }

  const contest = await prisma.contest.findUnique({
    where: { id },
    include: {
      questions: {
        include: { options: true }
      }
    }
  });

  if (!contest) {
    res.status(404).json({ success: false, message: "Contest not found" });
    return;
  }

  if (new Date() > contest.endsAt) {
    res.status(400).json({ success: false, message: "Contest has ended" });
    return;
  }

  const participation = await prisma.participation.findUnique({
    where: { userId_contestId: { userId, contestId: id } }
  });

  if (!participation) {
    res
      .status(400)
      .json({ success: false, message: "You have not joined this contest" });
    return;
  }

  if (participation.status === "SUBMITTED") {
    res.status(409).json({
      success: false,
      message: "You have already submitted this contest"
    });
    return;
  }

  // build a map of questionId -> correct optionIds
  const correctMap = new Map<string, Set<string>>();
  for (const question of contest.questions) {
    const correctIds = question.options
      .filter((o: any) => o.isCorrect)
      .map((o: any) => o.id);
    correctMap.set(question.id, new Set(correctIds));
  }

  // calculate score and build answer records
  let score = 0;
  const answerRecords: {
    participationId: string;
    questionId: string;
    optionId: string;
  }[] = [];

  for (const answer of answers) {
    const { questionId, optionIds } = answer;
    const question = contest.questions.find((q: any) => q.id === questionId);

    if (!question) continue;

    const correctIds = correctMap.get(questionId)!;
    const selectedIds = new Set<string>(optionIds);

    // all selected must be correct and match exactly
    const isCorrect =
      selectedIds.size === correctIds.size &&
      [...selectedIds].every((id) => correctIds.has(id));

    if (isCorrect) score += question.points;

    for (const optionId of optionIds) {
      answerRecords.push({
        participationId: participation.id,
        questionId,
        optionId
      });
    }
  }

  // save answers and update participation in a transaction
  await prisma.$transaction([
    prisma.answer.createMany({ data: answerRecords, skipDuplicates: true }),
    prisma.participation.update({
      where: { id: participation.id },
      data: { status: "SUBMITTED", score, submittedAt: new Date() }
    })
  ]);

  // upsert leaderboard entry
  const totalParticipants = await prisma.participation.count({
    where: { contestId: id, status: "SUBMITTED" }
  });

  await prisma.leaderboardEntry.upsert({
    where: { contestId_userId: { contestId: id, userId } },
    update: { score },
    create: { contestId: id, userId, score, rank: totalParticipants }
  });

  // recalculate ranks
  const entries = await prisma.leaderboardEntry.findMany({
    where: { contestId: id },
    orderBy: { score: "desc" }
  });

  await prisma.$transaction(
    entries.map((entry: any, index: number) =>
      prisma.leaderboardEntry.update({
        where: { id: entry.id },
        data: { rank: index + 1 }
      })
    )
  );

  // award prize if rank 1
  if (entries[0]?.userId === userId) {
    await prisma.prizeAwarded.upsert({
      where: { contestId_userId: { contestId: id, userId } },
      update: {},
      create: {
        contestId: id,
        userId,
        title: contest.prizeTitle,
        desc: contest.prizeDesc
      }
    });

    // remove prize from previous winner if dethroned
    if (entries[1]) {
      await prisma.prizeAwarded.deleteMany({
        where: { contestId: id, userId: entries[1].userId }
      });
    }
  }

  res.json({
    success: true,
    data: { score, totalQuestions: contest.questions.length }
  });
};

// GET /contests/:id/leaderboard
export const getLeaderboard = async (req: Request, res: Response) => {
  const { id } = req.params;

  const contest = await prisma.contest.findUnique({ where: { id } });
  if (!contest) {
    res.status(404).json({ success: false, message: "Contest not found" });
    return;
  }

  const leaderboard = await prisma.leaderboardEntry.findMany({
    where: { contestId: id },
    orderBy: { rank: "asc" },
    include: {
      user: { select: { id: true, username: true } }
    }
  });

  res.json({ success: true, data: leaderboard });
};
