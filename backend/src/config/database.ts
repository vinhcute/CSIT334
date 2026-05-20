import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

export async function checkDatabaseConnection(client: PrismaClient = prisma): Promise<boolean> {
  await client.$queryRaw`SELECT 1`;
  return true;
}
