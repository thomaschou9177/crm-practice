// lib/db.ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = global as unknown as { [key: string]: PrismaClient };

export const getPrismaClient = (tenantId?: string) => {
  // 1. 如果沒傳 tenantId，預設使用 "public"
  const schema = tenantId || 'public'; 
  const cacheKey = `prisma-${schema}`;

  if (globalForPrisma[cacheKey]) {
    return globalForPrisma[cacheKey];
  }

  const baseDbUrl = process.env.DATABASE_URL;
  
  // 2. 動態拼接 schema 參數
  // 這樣連線就會被導向到該 tenant 的 schema
  const tenantDbUrl = `${baseDbUrl}${baseDbUrl?.includes('?') ? '&' : '?'}schema=${schema}`;

  const client = new PrismaClient({
    datasources: {
      db: {
        url: tenantDbUrl,
      },
    },
    log: ['query', 'info', 'warn', 'error'],
  });

  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma[cacheKey] = client;
  }
  
  return client;
};

// 為了相容舊程式碼，可以保留一個預設導向 public 的 prisma 實體
export const prisma = getPrismaClient('public');