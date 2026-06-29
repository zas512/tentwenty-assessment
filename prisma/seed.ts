import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";
import {
  ContestAccess,
  ContestStatus,
  ParticipationStatus,
  PrismaClient,
  QuestionType,
  Role
} from "../src/prisma/client";

config({ override: true });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is not set in environment variables.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: DATABASE_URL })
});

const getSafeDbTarget = (url: string): string => {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname || "unknown-host";
    const port = parsed.port || "default";
    const dbName = parsed.pathname?.replace(/^\//, "") || "unknown-db";
    return `${host}:${port}/${dbName}`;
  } catch {
    return "unparseable DATABASE_URL";
  }
};

const pick = <T>(items: T[]): T =>
  items[Math.floor(Math.random() * items.length)];

const randInt = (min: number, max: number): number =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const shuffle = <T>(arr: T[]): T[] => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const randomDate = (from: Date, to: Date): Date => {
  const fromMs = from.getTime();
  const toMs = to.getTime();
  const randomMs = randInt(fromMs, toMs);
  return new Date(randomMs);
};

const createUsers = async (count: number) => {
  const firstNames = [
    "Noah",
    "Liam",
    "Zara",
    "Ava",
    "Omar",
    "Maya",
    "Ethan",
    "Riya",
    "Leo",
    "Ivy",
    "Aria",
    "Mason"
  ];
  const lastNames = [
    "Khan",
    "Smith",
    "Patel",
    "Brown",
    "Ali",
    "Wilson",
    "Ahmed",
    "Taylor",
    "Singh",
    "Lee",
    "Martin",
    "Clark"
  ];

  const users = [] as Awaited<ReturnType<typeof prisma.user.create>>[];

  for (let i = 0; i < count; i++) {
    const first = pick(firstNames);
    const last = pick(lastNames);
    const suffix = `${Date.now()}_${i}_${randInt(100, 999)}`;
    const username = `${first.toLowerCase()}_${last.toLowerCase()}_${suffix}`;
    const user = await prisma.user.create({
      data: {
        email: `${username}@example.com`,
        username,
        passwordHash: `dummy_hash_${suffix}`,
        role: pick([Role.ADMIN, Role.VIP, Role.USER, Role.GUEST])
      }
    });
    users.push(user);
  }
  return users;
};

const createContests = async (count: number) => {
  const themes = [
    "Tech Trivia",
    "History Blitz",
    "Science Sprint",
    "Math Masters",
    "Sports Spotlight",
    "Cinema Clash",
    "Geography Quest",
    "Logic Arena",
    "Space Challenge"
  ];
  const contests = [] as Awaited<ReturnType<typeof prisma.contest.create>>[];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const startsAt = randomDate(
      new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000),
      new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000)
    );
    const endsAt = new Date(
      startsAt.getTime() + randInt(1, 5) * 60 * 60 * 1000
    );
    const contest = await prisma.contest.create({
      data: {
        title: `${pick(themes)} #${randInt(100, 999)}`,
        description: `A random contest generated on ${new Date().toISOString()}`,
        access: pick([ContestAccess.NORMAL, ContestAccess.VIP]),
        status: pick([
          ContestStatus.DRAFT,
          ContestStatus.ACTIVE,
          ContestStatus.ENDED,
          ContestStatus.CANCELLED
        ]),
        startsAt,
        endsAt,
        prizeTitle: pick([
          "Gold Pass",
          "Premium Voucher",
          "Smart Gadget",
          "Gift Hamper"
        ]),
        prizeDesc: pick([
          "Top performer reward",
          "Exclusive winner package",
          "Special random reward",
          null
        ])
      }
    });
    contests.push(contest);
  }
  return contests;
};

const createQuestionsAndOptions = async (
  contests: Awaited<ReturnType<typeof prisma.contest.findMany>>
) => {
  const promptPool = [
    "Which statement is correct?",
    "Pick the best option.",
    "What is the most accurate answer?",
    "Choose all valid responses.",
    "Identify the true statement.",
    "Which one fits this context?",
    "Select the right choice."
  ];
  const questions = [] as Awaited<ReturnType<typeof prisma.question.create>>[];
  const optionsByQuestion = new Map<
    string,
    Awaited<ReturnType<typeof prisma.option.create>>[]
  >();
  for (const contest of contests) {
    const type = pick([
      QuestionType.SINGLE_SELECT,
      QuestionType.MULTI_SELECT,
      QuestionType.TRUE_FALSE
    ]);
    const question = await prisma.question.create({
      data: {
        contestId: contest.id,
        text: `${pick(promptPool)} (${contest.title})`,
        type,
        order: 1,
        points: randInt(1, 10)
      }
    });
    questions.push(question);
    const optionLabels =
      type === QuestionType.TRUE_FALSE
        ? ["True", "False"]
        : ["Option A", "Option B", "Option C", "Option D"];
    const correctIndex = randInt(0, optionLabels.length - 1);
    const createdOptions = [] as Awaited<
      ReturnType<typeof prisma.option.create>
    >[];
    for (let i = 0; i < optionLabels.length; i++) {
      const option = await prisma.option.create({
        data: {
          questionId: question.id,
          text: `${optionLabels[i]} ${randInt(1, 1000)}`,
          isCorrect: i === correctIndex,
          order: i + 1
        }
      });
      createdOptions.push(option);
    }
    optionsByQuestion.set(question.id, createdOptions);
  }
  return { questions, optionsByQuestion };
};

const createParticipations = async (
  users: Awaited<ReturnType<typeof prisma.user.findMany>>,
  contests: Awaited<ReturnType<typeof prisma.contest.findMany>>,
  targetCount: number
) => {
  const allPairs: Array<{ userId: string; contestId: string }> = [];
  for (const user of users) {
    for (const contest of contests) {
      allPairs.push({ userId: user.id, contestId: contest.id });
    }
  }
  const guaranteedPairs = contests.map((contest) => ({
    contestId: contest.id,
    userId: pick(users).id
  }));
  const guaranteedKeySet = new Set(
    guaranteedPairs.map((p) => `${p.userId}:${p.contestId}`)
  );
  const remainingPairs = shuffle(
    allPairs.filter((p) => !guaranteedKeySet.has(`${p.userId}:${p.contestId}`))
  );
  const needed = Math.max(
    contests.length,
    Math.min(targetCount, allPairs.length)
  );
  const selectedPairs = [
    ...guaranteedPairs,
    ...remainingPairs.slice(0, Math.max(0, needed - guaranteedPairs.length))
  ];
  const participations = [] as Awaited<
    ReturnType<typeof prisma.participation.create>
  >[];
  for (const pair of selectedPairs) {
    const status = pick([
      ParticipationStatus.IN_PROGRESS,
      ParticipationStatus.SUBMITTED
    ]);
    const submittedAt =
      status === ParticipationStatus.SUBMITTED
        ? randomDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), new Date())
        : null;
    const participation = await prisma.participation.create({
      data: {
        userId: pair.userId,
        contestId: pair.contestId,
        status,
        score: randInt(0, 100),
        submittedAt
      }
    });
    participations.push(participation);
  }
  return participations;
};

const createAnswers = async (
  participations: Awaited<ReturnType<typeof prisma.participation.findMany>>,
  questionsByContest: Map<
    string,
    Awaited<ReturnType<typeof prisma.question.create>>
  >,
  optionsByQuestion: Map<
    string,
    Awaited<ReturnType<typeof prisma.option.create>>[]
  >
) => {
  const answers = [] as Awaited<ReturnType<typeof prisma.answer.create>>[];
  for (const participation of participations) {
    const question = questionsByContest.get(participation.contestId);
    if (!question) {
      continue;
    }
    const options = optionsByQuestion.get(question.id) ?? [];
    if (options.length === 0) {
      continue;
    }
    const answer = await prisma.answer.create({
      data: {
        participationId: participation.id,
        questionId: question.id,
        optionId: pick(options).id
      }
    });
    answers.push(answer);
  }
  return answers;
};

const createLeaderboardEntries = async (
  contests: Awaited<ReturnType<typeof prisma.contest.findMany>>,
  participations: Awaited<ReturnType<typeof prisma.participation.findMany>>
) => {
  const entries = [] as Awaited<
    ReturnType<typeof prisma.leaderboardEntry.create>
  >[];
  for (const contest of contests) {
    const contestParticipations = participations
      .filter((p) => p.contestId === contest.id)
      .sort((a, b) => b.score - a.score);
    const top = contestParticipations.slice(0, 3);
    for (let i = 0; i < top.length; i++) {
      const entry = await prisma.leaderboardEntry.create({
        data: {
          contestId: contest.id,
          userId: top[i].userId,
          score: top[i].score,
          rank: i + 1
        }
      });
      entries.push(entry);
    }
  }
  return entries;
};

const createPrizes = async (
  leaderboardEntries: Awaited<
    ReturnType<typeof prisma.leaderboardEntry.findMany>
  >
) => {
  const prizes = [] as Awaited<ReturnType<typeof prisma.prizeAwarded.create>>[];
  const prizeByRank = [
    { title: "Champion Reward", desc: "Awarded for rank #1" },
    { title: "Runner-up Reward", desc: "Awarded for rank #2" },
    { title: "Merit Reward", desc: "Awarded for rank #3" }
  ];
  const selected = shuffle(leaderboardEntries).slice(
    0,
    Math.max(7, Math.min(12, leaderboardEntries.length))
  );
  for (const entry of selected) {
    const prizeInfo = prizeByRank[entry.rank - 1] ?? {
      title: "Participation Reward",
      desc: "Randomly assigned prize"
    };
    const prize = await prisma.prizeAwarded.create({
      data: {
        contestId: entry.contestId,
        userId: entry.userId,
        title: `${prizeInfo.title} ${randInt(100, 999)}`,
        desc: prizeInfo.desc
      }
    });
    prizes.push(prize);
  }
  return prizes;
};

const main = async () => {
  console.log("Seeding started...");
  console.log(`DB target: ${getSafeDbTarget(DATABASE_URL)}`);
  try {
    await prisma.$connect();
  } catch (error) {
    console.error("Database connection failed before seeding.");
    console.error(
      "Ensure PostgreSQL is running and DATABASE_URL points to a reachable server."
    );
    throw error;
  }

  await prisma.answer.deleteMany();
  await prisma.prizeAwarded.deleteMany();
  await prisma.leaderboardEntry.deleteMany();
  await prisma.participation.deleteMany();
  await prisma.option.deleteMany();
  await prisma.question.deleteMany();
  await prisma.contest.deleteMany();
  await prisma.user.deleteMany();
  const users = await createUsers(8);
  const contests = await createContests(7);
  const { questions, optionsByQuestion } =
    await createQuestionsAndOptions(contests);
  const questionsByContest = new Map<string, (typeof questions)[number]>();
  for (const question of questions) {
    questionsByContest.set(question.contestId, question);
  }
  const participations = await createParticipations(users, contests, 16);
  const answers = await createAnswers(
    participations,
    questionsByContest,
    optionsByQuestion
  );
  const leaderboardEntries = await createLeaderboardEntries(
    contests,
    participations
  );
  const prizes = await createPrizes(leaderboardEntries);
  const optionCount = Array.from(optionsByQuestion.values()).reduce(
    (acc, list) => acc + list.length,
    0
  );
  console.log("Seeding complete.");
  console.log("Inserted rows:");
  console.log(`- users: ${users.length}`);
  console.log(`- contests: ${contests.length}`);
  console.log(`- questions: ${questions.length}`);
  console.log(`- options: ${optionCount}`);
  console.log(`- participations: ${participations.length}`);
  console.log(`- answers: ${answers.length}`);
  console.log(`- leaderboardEntries: ${leaderboardEntries.length}`);
  console.log(`- prizeAwarded: ${prizes.length}`);
};

main()
  .catch((error) => {
    console.error("Seeding failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
