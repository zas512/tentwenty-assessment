import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";
import { PrismaClient } from "../prisma/client";

config({ override: true, quiet: true });

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

export const connectDB = async () => {
  await prisma.$connect();
  console.log("Connected to PostgreSQL");
};

export default prisma;
