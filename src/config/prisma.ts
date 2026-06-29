import { PrismaClient } from "../prisma/client";

const prisma = new (PrismaClient as any)();

export const connectDB = async () => {
  await prisma.$connect();
  console.log("Connected to PostgreSQL");
};

export default prisma;
