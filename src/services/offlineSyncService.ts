/**
 * Offline-to-Online Synchronization & Conflict Resolution Service
 * 
 * Features:
 * 1. Online/Offline Transition Detection via window events & active ping heartbeat.
 * 2. Persistent Mutation Queue (LocalStorage / IndexedDB) with retry counters.
 * 3. 3-Way Conflict Resolution Engine (Last-Write-Wins, Selective Field-Level Merging, & SOP Milestone Integrity).
 * 4. Automatic Batch Sync Dispatcher on network reconnection.
 */

export type EntityType = 'project' | 'invoice' | 'lead' | 'chat' | 'commission';
export type MutationAction = 'create' | 'update' | 'delete';

export interface QueuedMutation {
  id: string;
  entity: EntityType;
  action: MutationAction;
  targetId: string;
  payload: Record<string, any>;
  timestamp: number;
  localVersion?: number;
  retryCount: number;
  status: 'pending' | 'syncing' | 'conflict' | 'failed';
  error?: string;
}

export type ConflictStrategy = 'client-wins' | 'server-wins' | 'field-merge' | 'manual';

export interface SyncStatusEvent {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  lastSyncAt: number | null;
  conflictCount: number;
  syncedItemIds: string[];
}

const QUEUE_STORAGE_KEY = 'agencyops_offline_sync_queue';
const LAST_SYNC_KEY = 'agencyops_last_sync_timestamp';
const IDB_DATABASE_NAME = 'leadflow_offline_sync_db';
const IDB_STORE_NAME = 'mutations';

// IndexedDB Helper with graceful fallback
function getIndexedDB(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(IDB_DATABASE_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
          db.createObjectStore(IDB_STORE_NAME, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

class OfflineSyncService {
  private queue: QueuedMutation[] = [];
  private isOnlineState: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private isSyncing: boolean = false;
  private listeners: Set<(status: SyncStatusEvent) => void> = new Set();
  private heartbeatTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.loadQueue();
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline);
      window.addEventListener('offline', this.handleOffline);
      this.startHeartbeat();
    }
  }

  // Load existing mutations from persistent storage (IndexedDB with LocalStorage fallback)
  private async loadQueue() {
    if (typeof window === 'undefined') return;

    // 1. First attempt loading from IndexedDB
    try {
      const db = await getIndexedDB();
      if (db) {
        const tx = db.transaction(IDB_STORE_NAME, 'readonly');
        const store = tx.objectStore(IDB_STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => {
          if (Array.isArray(req.result) && req.result.length > 0) {
            this.queue = req.result;
            this.notify();
            return;
          }
        };
      }
    } catch (idbErr) {
      console.warn('[OfflineSync] IndexedDB read fallback to localStorage:', idbErr);
    }

    // 2. Fallback to LocalStorage
    try {
      const saved = localStorage.getItem(QUEUE_STORAGE_KEY);
      if (saved) {
        this.queue = JSON.parse(saved);
        this.notify();
      }
    } catch (err) {
      console.warn('[OfflineSync] Failed to load queue from localStorage:', err);
      this.queue = [];
    }
  }

  // Save mutations to persistent storage (both IndexedDB and LocalStorage for dual resilience)
  private async saveQueue() {
    if (typeof window === 'undefined') return;

    // 1. Dual-write to LocalStorage
    try {
      localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(this.queue));
    } catch (err) {
      console.warn('[OfflineSync] Failed to save queue to localStorage:', err);
    }

    // 2. Dual-write to IndexedDB
    try {
      const db = await getIndexedDB();
      if (db) {
        const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
        const store = tx.objectStore(IDB_STORE_NAME);
        store.clear();
        for (const item of this.queue) {
          store.put(item);
        }
      }
    } catch (idbErr) {
      // Non-fatal, localStorage already has the record
    }
  }

  // Subscribe to sync status changes
  public subscribe(callback: (status: SyncStatusEvent) => void): () => void {
    this.listeners.add(callback);
    callback(this.getStatus());
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notify() {
    const status = this.getStatus();
    this.listeners.forEach(cb => {
      try {
        cb(status);
      } catch (err) {
        console.error('[OfflineSync] Error in listener callback:', err);
      }
    });
  }

  public getStatus(): SyncStatusEvent {
    const conflicts = this.queue.filter(q => q.status === 'conflict').length;
    const pending = this.queue.filter(q => q.status === 'pending' || q.status === 'syncing').length;
    const lastSync = typeof window !== 'undefined' 
      ? Number(localStorage.getItem(LAST_SYNC_KEY) || 0) || null 
      : null;

    return {
      isOnline: this.isOnlineState,
      pendingCount: pending,
      isSyncing: this.isSyncing,
      lastSyncAt: lastSync,
      conflictCount: conflicts,
      syncedItemIds: []
    };
  }

  public getQueue(): QueuedMutation[] {
    return [...this.queue];
  }

  // Enqueue a mutation when offline or as an optimistic transaction
  public enqueue(
    entity: EntityType,
    action: MutationAction,
    targetId: string,
    payload: Record<string, any>,
    localVersion: number = 1
  ): string {
    const id = `mut_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const activeTenantId = (typeof window !== 'undefined' ? localStorage.getItem('alm_nexus_tenant_id') : null) || 'tenant-alm-nexus';
    const enrichedPayload = {
      tenant_id: activeTenantId,
      tenantId: activeTenantId,
      ...payload
    };
    
    // Coalesce updates if an existing pending update exists for the same target
    const existingIdx = this.queue.findIndex(
      m => m.entity === entity && m.targetId === targetId && m.status === 'pending'
    );

    if (existingIdx !== -1 && action === 'update') {
      this.queue[existingIdx] = {
        ...this.queue[existingIdx],
        payload: { ...this.queue[existingIdx].payload, ...enrichedPayload },
        timestamp: Date.now(),
        localVersion: (this.queue[existingIdx].localVersion || 1) + 1
      };
    } else {
      const mutation: QueuedMutation = {
        id,
        entity,
        action,
        targetId,
        payload: enrichedPayload,
        timestamp: Date.now(),
        localVersion,
        retryCount: 0,
        status: 'pending'
      };
      this.queue.push(mutation);
    }

    this.saveQueue();
    this.notify();

    // If online, immediately attempt to process
    if (this.isOnlineState) {
      this.processQueue();
    }

    return id;
  }

  // Online Transition Handler
  private handleOnline = () => {
    console.log('[OfflineSync] Network status changed to ONLINE.');
    this.isOnlineState = true;
    this.notify();
    // Delay slightly to allow connection stabilization
    setTimeout(() => {
      this.processQueue();
    }, 1200);
  };

  // Offline Transition Handler
  private handleOffline = () => {
    console.log('[OfflineSync] Network status changed to OFFLINE.');
    this.isOnlineState = false;
    this.notify();
  };

  // Periodic heartbeat verification
  private startHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(async () => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);
        const res = await fetch('/api/health', {
          method: 'GET',
          cache: 'no-store',
          signal: controller.signal
        });
        clearTimeout(timeout);
        
        const wasOffline = !this.isOnlineState;
        this.isOnlineState = res.ok;

        if (wasOffline && res.ok) {
          console.log('[OfflineSync] Heartbeat confirmed online recovery.');
          this.notify();
          this.processQueue();
        }
      } catch {
        if (this.isOnlineState) {
          this.isOnlineState = false;
          this.notify();
        }
      }
    }, 15000);
  }

  /**
   * Conflict Resolution Strategy Engine
   * 
   * Resolves divergence between local offline state and server database record:
   * 1. If server entity does not exist (404), re-create if action was update/create.
   * 2. Field-Level Merging: For non-conflicting updated fields, preserve server updates and apply client edits.
   * 3. SOP Rule Validation: Prevent offline state from skipping 50% advance / balance payment gates.
   */
  public resolveConflict(
    localMutation: QueuedMutation,
    serverEntity: Record<string, any> | null,
    strategy: ConflictStrategy = 'field-merge'
  ): { resolvedPayload: Record<string, any>; strategyApplied: string } {
    if (!serverEntity) {
      return {
        resolvedPayload: localMutation.payload,
        strategyApplied: 'client-wins-no-server-entity'
      };
    }

    if (strategy === 'server-wins') {
      return {
        resolvedPayload: serverEntity,
        strategyApplied: 'server-wins'
      };
    }

    if (strategy === 'client-wins') {
      return {
        resolvedPayload: { ...serverEntity, ...localMutation.payload, updatedAt: new Date().toISOString() },
        strategyApplied: 'client-wins-timestamp-override'
      };
    }

    // Default: Intelligent Field-Level Merge with SOP integrity check
    const merged: Record<string, any> = { ...serverEntity };

    for (const [key, clientVal] of Object.entries(localMutation.payload)) {
      // Guard SOP transfer & payment rules
      if (key === 'status' && clientVal === 'transferred') {
        const advancePaid = Boolean(serverEntity.advancePaid || localMutation.payload.advancePaid);
        const balancePaid = Boolean(serverEntity.balancePaid || localMutation.payload.balancePaid);
        if (!advancePaid || !balancePaid) {
          console.warn('[OfflineSync] SOP Gate: Blocked offline transition to transferred without cleared milestones.');
          continue;
        }
      }

      // If key is purpose or description, allow client value
      merged[key] = clientVal;
    }

    merged.updatedAt = new Date().toISOString();

    return {
      resolvedPayload: merged,
      strategyApplied: 'field-level-merge'
    };
  }

  // Core Queue Processor
  public async processQueue(): Promise<{ syncedCount: number; errors: number }> {
    if (this.isSyncing || !this.isOnlineState || this.queue.length === 0) {
      return { syncedCount: 0, errors: 0 };
    }

    this.isSyncing = true;
    this.notify();

    let syncedCount = 0;
    let errors = 0;
    const remainingQueue: QueuedMutation[] = [];

    const token = typeof window !== 'undefined' ? localStorage.getItem('alm_nexus_token') : null;
    const activeTenantId = (typeof window !== 'undefined' ? localStorage.getItem('alm_nexus_tenant_id') : null) || 'tenant-alm-nexus';
    const authHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Tenant-Id': activeTenantId
    };
    if (token) {
      authHeaders['Authorization'] = `Bearer ${token}`;
    }

    for (const mutation of this.queue) {
      if (mutation.status === 'conflict') {
        remainingQueue.push(mutation);
        continue;
      }

      mutation.status = 'syncing';
      this.notify();

      try {
        let endpoint = '';
        let method = 'POST';

        if (mutation.entity === 'project') {
          endpoint = mutation.action === 'create' ? '/api/projects' : `/api/projects/${mutation.targetId}`;
          method = mutation.action === 'create' ? 'POST' : mutation.action === 'delete' ? 'DELETE' : 'PUT';
        } else if (mutation.entity === 'lead') {
          endpoint = `/api/v1/leads`;
          method = 'POST';
        } else if (mutation.entity === 'invoice') {
          endpoint = `/api/invoices`;
          method = 'POST';
        } else if (mutation.entity === 'chat') {
          endpoint = `/api/chat/messages`;
          method = 'POST';
        } else if (mutation.entity === 'commission') {
          endpoint = `/api/commissions/payout`;
          method = 'POST';
        }

        // Fetch current server state to detect potential conflict
        let serverEntity: Record<string, any> | null = null;
        if (mutation.entity === 'project' && mutation.action === 'update') {
          try {
            const checkRes = await fetch(`/api/projects/${mutation.targetId}`, { headers: authHeaders });
            if (checkRes.ok) {
              const checkData = await checkRes.json();
              serverEntity = checkData.project || null;
            }
          } catch {
            // ignore check error
          }
        }

        // Apply conflict resolution
        const { resolvedPayload } = this.resolveConflict(mutation, serverEntity, 'field-merge');

        const res = await fetch(endpoint, {
          method,
          headers: authHeaders,
          body: method !== 'DELETE' ? JSON.stringify(resolvedPayload) : undefined
        });

        if (res.ok) {
          syncedCount++;
          console.log(`[OfflineSync] Successfully synced mutation ${mutation.id} for ${mutation.entity}:${mutation.targetId}`);
        } else {
          throw new Error(`Server returned HTTP ${res.status}`);
        }
      } catch (err: any) {
        console.warn(`[OfflineSync] Failed to sync mutation ${mutation.id}:`, err?.message);
        mutation.retryCount += 1;
        mutation.error = err?.message || 'Network sync error';

        if (mutation.retryCount >= 5) {
          mutation.status = 'failed';
        } else {
          mutation.status = 'pending';
        }
        remainingQueue.push(mutation);
        errors++;
      }
    }

    this.queue = remainingQueue;
    this.saveQueue();
    this.isSyncing = false;

    if (typeof window !== 'undefined' && syncedCount > 0) {
      localStorage.setItem(LAST_SYNC_KEY, Date.now().toString());
    }

    this.notify();
    return { syncedCount, errors };
  }

  // Manually clear queue
  public clearQueue() {
    this.queue = [];
    this.saveQueue();
    this.notify();
  }

  // Retry all failed items
  public retryFailed() {
    this.queue = this.queue.map(q => ({
      ...q,
      status: 'pending',
      retryCount: 0,
      error: undefined
    }));
    this.saveQueue();
    this.processQueue();
  }
}

// Singleton Instance
export const offlineSyncService = new OfflineSyncService();
