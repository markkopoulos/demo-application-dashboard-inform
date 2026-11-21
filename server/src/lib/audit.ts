import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";
import { logger } from "./logger.js";

export interface AuditEntry {
  action: string;
  actorId?: string | null;
  centerId?: string | null;
  entityType?: string;
  entityId?: string;
  metadata?: Prisma.InputJsonValue;
  ip?: string | null;
}

// Audit writes must never break the request that triggered them.
export async function audit(entry: AuditEntry) {
  try {
    await prisma.auditLog.create({ data: { ...entry, ip: entry.ip ?? undefined } });
  } catch (err) {
    logger.error({ err, action: entry.action }, "failed to write audit log");
  }
}
