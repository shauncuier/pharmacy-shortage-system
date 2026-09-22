import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  prismaOptimized: boolean | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// Apply high-performance SQLite PRAGMAs once per process for maximum speed
if (!globalForPrisma.prismaOptimized) {
  globalForPrisma.prismaOptimized = true
  Promise.all([
    prisma.$queryRawUnsafe('PRAGMA journal_mode = WAL;'),
    prisma.$queryRawUnsafe('PRAGMA synchronous = NORMAL;'),
    prisma.$queryRawUnsafe('PRAGMA cache_size = -64000;'),
    prisma.$queryRawUnsafe('PRAGMA mmap_size = 268435456;'),
    prisma.$queryRawUnsafe('PRAGMA temp_store = MEMORY;'),
    prisma.$queryRawUnsafe('PRAGMA busy_timeout = 5000;'),
  ]).catch(() => {})
}
