import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface LogAuditParams {
  action: string;
  details?: string | object;
  userId?: string;
  ipAddress?: string;
}

export class AuditLogger {
  static async log(params: LogAuditParams) {
    try {
      const detailsStr = typeof params.details === 'object' ? JSON.stringify(params.details) : params.details;
      await prisma.auditLog.create({
        data: {
          action: params.action,
          details: detailsStr || null,
          userId: params.userId || null,
          ipAddress: params.ipAddress || null,
        },
      });
    } catch (err) {
      console.error('AuditLogger Error:', err);
    }
  }
}
