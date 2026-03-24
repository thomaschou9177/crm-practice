import { PrismaClient } from '@prisma/client'

const globalForPrisma = global as unknown as { prisma: PrismaClient }

// This ensures we only have ONE connection instance 
// across hot-reloads in development mode.
export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    // Prisma 7 requires the URL to be explicitly passed or 
    // handled via your prisma.config.ts
    // datasources: {
    //   db: {
    //     url: process.env.DATABASE_URL,
    //   },
    // },
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma