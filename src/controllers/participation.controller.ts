import { Request, Response } from "express";
import prisma from "../config/prisma";
import {
  ContestAccess,
  ContestStatus,
  ParticipationStatus,
  QuestionType,
  Role
} from "../prisma/client";

const canAccessContest = (role: Role, access: ContestAccess) => {
  if (role === Role.ADMIN) return true;
  if (access === ContestAccess.VIP) {
    return role === Role.VIP;
  }
  return true;
};

type QuestionForSubmission = {
  id: string;
  type: QuestionType;
  points: number;
  options: { id: string; isCorrect: boolean }[];
};

type ContestForSubmission = {
  access: ContestAccess;
  status: ContestStatus;
  startsAt: Date;
  endsAt: Date;
  questions: QuestionForSubmission[];
};

type SubmitAnswerInput = {
  questionId?: string;
  optionIds?: string[];
};

type ParsedAnswer = {
  questionId: string;
  uniqueOptionIds: string[];
};

const validateContestWindow = (
  contest: Pick<
    ContestForSubmission,
    "status" | "startsAt" | "endsAt" | "access"
  >,
  role: Role,
  now: Date
): string | null => {
  if (contest.status !== ContestStatus.ACTIVE) {
    return "Contest is not active";
  }
  if (!canAccessContest(role, contest.access)) {
    return "This contest is for VIP users only";
  }
  if (now < contest.startsAt) {
    return "Contest has not started yet";
  }
  if (now > contest.endsAt) {
    return "Contest has ended";
  }
  return null;
};

const buildSubmission = (
  answers: SubmitAnswerInput[],
  questions: QuestionForSubmission[],
  participationId: string
):
  | {
      score: number;
      answerRecords: {
        participationId: string;
        questionId: string;
        optionId: string;
      }[];
    }
  | { error: string } => {
  const questionMap = new Map(
    questions.map((question) => [question.id, question])
  );
  const correctMap = new Map<string, Set<string>>();
  for (const question of questions) {
    const correctIds = question.options
      .filter((o) => o.isCorrect)
      .map((o) => o.id);
    correctMap.set(question.id, new Set(correctIds));
  }

  let score = 0;
  const answerRecords: {
    participationId: string;
    questionId: string;
    optionId: string;
  }[] = [];
  const answeredQuestions = new Set<string>();
  for (const answer of answers) {
    const parsed = parseAnswer(answer);
    if ("error" in parsed) {
      return parsed;
    }
    const duplicateError = validateQuestionNotDuplicated(
      parsed.questionId,
      answeredQuestions
    );
    if (duplicateError) {
      return { error: duplicateError };
    }
    const question = questionMap.get(parsed.questionId);
    if (!question) {
      return { error: `Invalid questionId: ${parsed.questionId}` };
    }
    const selectionError = validateSelection(question, parsed.uniqueOptionIds);
    if (selectionError) {
      return { error: selectionError };
    }
    if (
      isAnswerCorrect(parsed.questionId, parsed.uniqueOptionIds, correctMap)
    ) {
      score += question.points;
    }
    for (const optionId of parsed.uniqueOptionIds) {
      answerRecords.push({
        participationId,
        questionId: parsed.questionId,
        optionId
      });
    }
  }
  return { score, answerRecords };
};

const parseAnswer = (
  answer: SubmitAnswerInput
): ParsedAnswer | { error: string } => {
  const { questionId, optionIds } = answer ?? {};
  if (!questionId || !Array.isArray(optionIds) || optionIds.length === 0) {
    return { error: "Each answer must include questionId and optionIds[]" };
  }
  return {
    questionId,
    uniqueOptionIds: [...new Set(optionIds)]
  };
};

const validateQuestionNotDuplicated = (
  questionId: string,
  answeredQuestions: Set<string>
): string | null => {
  if (answeredQuestions.has(questionId)) {
    return "A question can only be answered once";
  }
  answeredQuestions.add(questionId);
  return null;
};

const validateSelection = (
  question: QuestionForSubmission,
  optionIds: string[]
): string | null => {
  const validOptionIds = new Set(question.options.map((option) => option.id));
  if (optionIds.some((optionId) => !validOptionIds.has(optionId))) {
    return "One or more selected options do not belong to the question";
  }
  if (
    (question.type === QuestionType.SINGLE_SELECT ||
      question.type === QuestionType.TRUE_FALSE) &&
    optionIds.length !== 1
  ) {
    return `Question ${question.id} accepts exactly one selected option`;
  }
  return null;
};

const isAnswerCorrect = (
  questionId: string,
  optionIds: string[],
  correctMap: Map<string, Set<string>>
) => {
  const selectedIds = new Set(optionIds);
  const correctIds = correctMap.get(questionId)!;
  return (
    selectedIds.size === correctIds.size &&
    [...selectedIds].every((selectedId) => correctIds.has(selectedId))
  );
};

export const joinContest = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;
  const role = req.user!.role;
  const now = new Date();
  const contest = await prisma.contest.findUnique({ where: { id } });
  if (!contest) {
    res.status(404).json({ success: false, message: "Contest not found" });
    return;
  }
  if (contest.status !== ContestStatus.ACTIVE) {
    res.status(400).json({ success: false, message: "Contest is not active" });
    return;
  }
  if (now < contest.startsAt) {
    res
      .status(400)
      .json({ success: false, message: "Contest has not started yet" });
    return;
  }
  if (now > contest.endsAt) {
    res.status(400).json({ success: false, message: "Contest has ended" });
    return;
  }
  if (!canAccessContest(role, contest.access)) {
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

export const submitContest = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;
  const role = req.user!.role;
  const { answers } = req.body;
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
  const now = new Date();
  const contestWindowError = validateContestWindow(contest, role, now);
  if (contestWindowError) {
    const statusCode =
      contestWindowError === "This contest is for VIP users only" ? 403 : 400;
    res
      .status(statusCode)
      .json({ success: false, message: contestWindowError });
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
  if (participation.status === ParticipationStatus.SUBMITTED) {
    res.status(409).json({
      success: false,
      message: "You have already submitted this contest"
    });
    return;
  }
  const submission = buildSubmission(
    answers as SubmitAnswerInput[],
    contest.questions,
    participation.id
  );
  if ("error" in submission) {
    res.status(400).json({ success: false, message: submission.error });
    return;
  }
  await prisma.$transaction([
    prisma.answer.createMany({ data: submission.answerRecords }),
    prisma.participation.update({
      where: { id: participation.id },
      data: {
        status: ParticipationStatus.SUBMITTED,
        score: submission.score,
        submittedAt: now
      }
    })
  ]);
  await prisma.leaderboardEntry.upsert({
    where: { contestId_userId: { contestId: id, userId } },
    update: { score: submission.score },
    create: {
      contestId: id,
      userId,
      score: submission.score,
      rank: Number.MAX_SAFE_INTEGER
    }
  });
  const entries = await prisma.leaderboardEntry.findMany({
    where: { contestId: id },
    orderBy: [{ score: "desc" }, { updatedAt: "asc" }]
  });
  await prisma.$transaction(
    entries.map((entry: any, index: number) =>
      prisma.leaderboardEntry.update({
        where: { id: entry.id },
        data: { rank: index + 1 }
      })
    )
  );
  const winner = entries[0];
  if (winner) {
    await prisma.$transaction([
      prisma.prizeAwarded.deleteMany({ where: { contestId: id } }),
      prisma.prizeAwarded.create({
        data: {
          contestId: id,
          userId: winner.userId,
          title: contest.prizeTitle,
          desc: contest.prizeDesc
        }
      })
    ]);
  }
  const myRank = entries.find((entry) => entry.userId === userId)?.rank ?? null;
  res.json({
    success: true,
    data: {
      score: submission.score,
      rank: myRank,
      totalQuestions: contest.questions.length
    }
  });
};

export const getLeaderboard = async (req: Request, res: Response) => {
  const { id } = req.params;
  const rawLimit = Number(req.query.limit ?? 50);
  const rawOffset = Number(req.query.offset ?? 0);
  const limit = Number.isNaN(rawLimit)
    ? 50
    : Math.max(1, Math.min(rawLimit, 200));
  const offset = Number.isNaN(rawOffset) ? 0 : Math.max(0, rawOffset);
  const contest = await prisma.contest.findUnique({ where: { id } });
  if (!contest) {
    res.status(404).json({ success: false, message: "Contest not found" });
    return;
  }
  const leaderboard = await prisma.leaderboardEntry.findMany({
    where: { contestId: id },
    orderBy: { rank: "asc" },
    take: limit,
    skip: offset,
    include: {
      user: { select: { id: true, username: true } }
    }
  });
  res.json({ success: true, data: leaderboard });
};
