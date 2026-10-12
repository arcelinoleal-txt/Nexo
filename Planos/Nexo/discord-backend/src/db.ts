/* ================================================================
   Database Connection with Prisma + SQLite
   ================================================================ */

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient({
  // Log queries during development
  log: ['query', 'error', 'warn'],
  // Disable auto migration for production
  // In production, use: migrationEmbed: true
});

// Close prisma on app exit
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});