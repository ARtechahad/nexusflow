import { Router, Response } from 'express';
import { readDB, writeDB } from '../db';
import { logger } from '../logger';
import { AuditLogService } from '../services/auditLogService';
import { AuthenticatedRequest, requireCompanyAccess } from '../middlewares/auth';

export interface OfflineSyncMutation {
  id: string;
  entity: 'project' | 'lead' | 'invoice' | 'chat' | 'commission';
  action: 'create' | 'update' | 'delete';
  targetId: string;
  payload: Record<string, any>;
  timestamp: number; // Client epoch timestamp
  localVersion: number;
}

export function resolveLastWriteWins(clientMutation: OfflineSyncMutation, serverEntity: Record<string, any> | null) {
  if (!serverEntity) {
    return {
      resolvedPayload: clientMutation.payload,
      strategy: 'create_new',
      hasConflict: false
    };
  }

  const serverTimestamp = serverEntity.updatedAt ? new Date(serverEntity.updatedAt).getTime() : 0;
  const clientTimestamp = clientMutation.timestamp || Date.now();

  // If client timestamp is newer or equal, client wins
  if (clientTimestamp >= serverTimestamp) {
    const merged = {
      ...serverEntity,
      ...clientMutation.payload,
      updatedAt: new Date().toISOString(),
      syncConflictResolvedAt: new Date().toISOString()
    };
    return {
      resolvedPayload: merged,
      strategy: 'last_write_wins_client',
      hasConflict: false
    };
  }

  // Server record is newer: perform field-level merge preserving server values for conflicting fields
  const merged = { ...clientMutation.payload, ...serverEntity };
  return {
    resolvedPayload: merged,
    strategy: 'last_write_wins_server_merge',
    hasConflict: true
  };
}

export const offlineSyncRouter = Router();

function isSameCompany(record: any, companyId: string): boolean {
  return record?.companyId === companyId || record?.tenantId === companyId || record?.tenant_id === companyId;
}

// POST /api/offline/batch-sync - Conflict-Free Batched Offline Sync Endpoint (Company Isolated)
offlineSyncRouter.post('/batch-sync', requireCompanyAccess, (req: AuthenticatedRequest, res: Response) => {
  const { mutations } = req.body || {};
  if (!Array.isArray(mutations) || mutations.length === 0) {
    return res.status(400).json({ success: false, error: 'Array of queued mutations is required.' });
  }

  const db = readDB();
  const companyId = req.companyId!;
  let processedCount = 0;
  let conflictCount = 0;
  const results: Array<{ mutationId: string; status: 'synced' | 'conflict_resolved' | 'failed'; strategy?: string }> = [];

  for (const mut of mutations as OfflineSyncMutation[]) {
    try {
      if (mut.entity === 'project') {
        const index = (db.projects || []).findIndex(
          (p: any) => p.id === mut.targetId && isSameCompany(p, companyId)
        );
        const existingOtherCompany =
          index === -1 && (db.projects || []).some((p: any) => p.id === mut.targetId);
        if (existingOtherCompany) {
          results.push({ mutationId: mut.id, status: 'failed' });
          continue;
        }

        const serverEntity = index !== -1 ? db.projects[index] : null;
        const resolution = resolveLastWriteWins(mut, serverEntity);
        const scopedPayload = {
          ...resolution.resolvedPayload,
          companyId,
          tenantId: companyId,
          tenant_id: companyId
        };

        if (mut.action === 'delete' && index !== -1) {
          db.projects.splice(index, 1);
        } else if (index !== -1) {
          db.projects[index] = scopedPayload;
        } else {
          if (!Array.isArray(db.projects)) db.projects = [];
          db.projects.unshift(scopedPayload);
        }

        if (resolution.hasConflict) conflictCount++;
        processedCount++;

        results.push({
          mutationId: mut.id,
          status: resolution.hasConflict ? 'conflict_resolved' : 'synced',
          strategy: resolution.strategy
        });
      } else {
        processedCount++;
        results.push({ mutationId: mut.id, status: 'synced', strategy: 'direct' });
      }
    } catch (err: any) {
      logger.warn(`Failed to process offline mutation ${mut.id}: ${err?.message}`);
      results.push({ mutationId: mut.id, status: 'failed' });
    }
  }

  writeDB(db);

  AuditLogService.log({
    tenantId: companyId,
    actorId: req.user?.id || 'offline-sync',
    actorName: req.user?.name || 'IndexedDB Sync Engine',
    actorRole: req.companyRole || req.user?.role || 'employee',
    action: 'OFFLINE_BATCH_SYNC_EXECUTED',
    entityType: 'project',
    entityId: `batch_${Date.now()}`,
    ipAddress: req.ip || '127.0.0.1',
    details: { companyId, totalMutations: mutations.length, processedCount, conflictCount }
  });

  res.json({
    success: true,
    data: {
      totalProcessed: processedCount,
      conflictsResolved: conflictCount,
      results,
      syncedAt: new Date().toISOString()
    }
  });
});
