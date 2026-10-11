import { readDB, writeDB } from '../db';
import { logger } from '../logger';

export interface EnhancedAuditLogRecord {
  id: string;
  timestamp: string;
  tenantId: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  action: string;
  entityType: 'project' | 'lead' | 'invoice' | 'commission' | 'credential' | 'user' | 'tenant' | 'rate_card' | 'webhook';
  entityId: string;
  ipAddress: string;
  details?: Record<string, any>;
  diff?: {
    previous?: Record<string, any>;
    updated?: Record<string, any>;
  };
}

export class AuditLogService {
  public static log(record: Omit<EnhancedAuditLogRecord, 'id' | 'timestamp'>): EnhancedAuditLogRecord {
    const db = readDB();
    if (!Array.isArray(db.auditLogs)) {
      db.auditLogs = [];
    }

    const fullRecord: EnhancedAuditLogRecord = {
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      tenantId: record.tenantId || 'tenant-alm-nexus',
      actorId: record.actorId || 'system',
      actorName: record.actorName || 'System Process',
      actorRole: record.actorRole || 'admin',
      action: record.action,
      entityType: record.entityType,
      entityId: record.entityId,
      ipAddress: record.ipAddress || '127.0.0.1',
      details: record.details || {},
      diff: record.diff
    };

    db.auditLogs.unshift(fullRecord as any);

    // Keep log buffer bounded to latest 2000 records
    if (db.auditLogs.length > 2000) {
      db.auditLogs = db.auditLogs.slice(0, 2000);
    }

    writeDB(db);

    logger.info(`Audit Trail: [${fullRecord.action}] on ${fullRecord.entityType}:${fullRecord.entityId} by ${fullRecord.actorName}`, {
      context: 'AuditLog',
      tenantId: fullRecord.tenantId,
      userId: fullRecord.actorId
    });

    return fullRecord;
  }

  public static getLogs(tenantId?: string, limit: number = 100): EnhancedAuditLogRecord[] {
    const db = readDB();
    let logs = (db.auditLogs || []) as EnhancedAuditLogRecord[];

    if (tenantId && tenantId !== 'all') {
      logs = logs.filter(l => !l.tenantId || l.tenantId === tenantId || l.tenantId === 'tenant-global');
    }

    return logs.slice(0, limit);
  }
}
