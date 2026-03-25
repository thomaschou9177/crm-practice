import { PrismaClient } from '@prisma/client'

const globalForPrisma = global as any
// This ensures we only have ONE connection instance 
// across hot-reloads in development mode.
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Adding this can help debug connection issues
    log: ['query', 'info', 'warn', 'error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma