import { PrismaClient } from "./generated/prisma/index.js";

const accelerateUrl = process.env.DATABASE_URL;
if (!accelerateUrl) {
  throw new Error("DATABASE_URL is not set");
}

export const prismaClient = new PrismaClient({
  accelerateUrl,
});
