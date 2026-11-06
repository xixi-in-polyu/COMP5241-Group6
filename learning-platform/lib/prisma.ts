import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required to initialize Prisma.");
}

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

if (!globalForPrisma.prisma) {
  const adapter = new PrismaPg({ 
    connectionString,
    // 针对 Serverless 数据库 (如 Neon) 的容错配置：
    max: 10, // 限制最大连接数
    idleTimeoutMillis: 30000, // 空闲 30 秒后主动断开（避免被 Neon 强制掐断）
    connectionTimeoutMillis: 15000, // 连接超时 15 秒（给数据库留足唤醒时间）
  });
  
  globalForPrisma.prisma = new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma;