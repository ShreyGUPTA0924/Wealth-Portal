import { PrismaClient } from '@prisma/client';

// Prevent multiple Prisma Client instances during nodemon hot-reloads in dev.
// In production, a fresh instance is created once and reused for the process lifetime.
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env['NODE_ENV'] === 'development'
        ? ['error', 'warn']
        : ['error'],
  });

if (process.env['NODE_ENV'] !== 'production') {
  globalForPrisma.prisma = prisma;
}
