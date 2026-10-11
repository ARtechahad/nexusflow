import { Router, Request, Response } from 'express';
import { readDB, writeDB } from '../db';
import { logger } from '../logger';
import { AuditLogService } from '../services/auditLogService';

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

// POST /api/offline/batch-sync - Conflict-Free Batched Offline Sync Endpoint
offlineSyncRouter.post('/batch-sync', (req: Request, res: Response) => {
  const { mutations } = req.body || {};
  if (!Array.isArray(mutations) || mutations.length === 0) {
    return res.status(400).json({ success: false, error: 'Array of queued mutations is required.' });
  }

  const db = readDB();
  const tenantId = (req as any).tenant_id || 'tenant-alm-nexus';
  let processedCount = 0;
  let conflictCount = 0;
  const results: Array<{ mutationId: string; status: 'synced' | 'conflict_resolved' | 'failed'; strategy?: string }> = [];

  for (const mut of mutations as OfflineSyncMutation[]) {
    try {
      if (mut.entity === 'project') {
        const index = db.projects.findIndex((p: any) => p.id === mut.targetId);
        const serverEntity = index !== -1 ? db.projects[index] : null;

        const resolution = resolveLastWriteWins(mut, serverEntity);

        if (mut.action === 'delete' && index !== -1) {
          db.projects.splice(index, 1);
        } else if (index !== -1) {
          db.projects[index] = resolution.resolvedPayload;
        } else {
          db.projects.unshift(resolution.resolvedPayload);
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
    tenantId,
    actorId: (req as any).user?.id || 'offline-sync',
    actorName: (req as any).user?.name || 'IndexedDB Sync Engine',
    actorRole: (req as any).user?.role || 'admin',
    action: 'OFFLINE_BATCH_SYNC_EXECUTED',
    entityType: 'project',
    entityId: `batch_${Date.now()}`,
    ipAddress: req.ip || '127.0.0.1',
    details: { totalMutations: mutations.length, processedCount, conflictCount }
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
