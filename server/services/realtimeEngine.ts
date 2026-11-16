import { Request, Response, Router } from 'express';
import { logger } from '../logger';
import { getDB } from '../db';
import { verifyToken, getUserMemberships, CompanyRole } from '../middlewares/auth';

export interface SSEClient {
  id: string;
  companyId: string;
  tenantId: string;
  userId: string;
  companyRole: CompanyRole;
  departmentIds: string[];
  res: Response;
  connectedAt: string;
}

class RealtimeBroadcaster {
  private clients: Map<string, SSEClient> = new Map();

  public addClient(client: SSEClient): void {
    this.clients.set(client.id, client);
    logger.info(`SSE Client connected: ${client.id} (Company: ${client.companyId}, Role: ${client.companyRole})`, {
      context: 'RealtimeSSE',
      tenantId: client.companyId,
      userId: client.userId
    });

    this.sendToClient(client.id, 'connected', {
      clientId: client.id,
      companyId: client.companyId,
      tenantId: client.companyId,
      companyRole: client.companyRole,
      departmentIds: client.departmentIds,
      status: 'active',
      timestamp: new Date().toISOString()
    });
  }

  public removeClient(id: string): void {
    const client = this.clients.get(id);
    if (client) {
      this.clients.delete(id);
      logger.info(`SSE Client disconnected: ${id}`, {
        context: 'RealtimeSSE',
        tenantId: client.companyId
      });
    }
  }

  public updateClientMembership(userId: string, companyId: string, companyRole: CompanyRole, departmentIds: string[]): void {
    this.clients.forEach((client) => {
      if (client.userId === userId && client.companyId === companyId) {
        client.companyRole = companyRole;
        client.departmentIds = departmentIds;
      }
    });
  }

  /**
   * Strict company-only broadcast (zero cross-company leakage)
   */
  public broadcastToCompany(companyId: string, eventName: string, data: any): void {
    if (!companyId || companyId === 'all') return;
    let deliveredCount = 0;
    this.clients.forEach((client, id) => {
      if (client.companyId === companyId) {
        this.sendToClient(id, eventName, data);
        deliveredCount++;
      }
    });

    logger.debug(`Broadcasted event "${eventName}" to ${deliveredCount} clients in company ${companyId}`, {
      context: 'RealtimeSSE',
      tenantId: companyId
    });
  }

  /**
   * Strict department-scoped broadcast inside a company.
   * Company admins receive events for all departments in their company;
   * Department heads & employees receive events ONLY for departments they belong to.
   */
  public broadcastToDepartment(companyId: string, departmentId: string, eventName: string, data: any): void {
    if (!companyId || !departmentId) return;
    let deliveredCount = 0;
    this.clients.forEach((client, id) => {
      if (client.companyId !== companyId) return;
      const isAllowed =
        client.companyRole === 'company_admin' ||
        (Array.isArray(client.departmentIds) && client.departmentIds.includes(departmentId));
      if (isAllowed) {
        this.sendToClient(id, eventName, data);
        deliveredCount++;
      }
    });

    logger.debug(`Broadcasted "${eventName}" to ${deliveredCount} clients in dept ${departmentId} (company ${companyId})`, {
      context: 'RealtimeSSE',
      tenantId: companyId
    });
  }

  /**
   * Safe alias for legacy callers (strictly isolated to single tenantId)
   */
  public broadcastToTenant(tenantId: string, eventName: string, data: any): void {
    this.broadcastToCompany(tenantId, eventName, data);
  }

  public sendToClient(clientId: string, eventName: string, data: any): boolean {
    const client = this.clients.get(clientId);
    if (!client) return false;

    try {
      client.res.write(`event: ${eventName}\n`);
      client.res.write(`data: ${JSON.stringify(data)}\n\n`);
      return true;
    } catch {
      this.removeClient(clientId);
      return false;
    }
  }

  public getActiveClientCount(companyId?: string): number {
    if (!companyId) return this.clients.size;
    let count = 0;
    this.clients.forEach((c) => {
      if (c.companyId === companyId) count++;
    });
    return count;
  }
}

export const realtimeEngine = new RealtimeBroadcaster();

export const eventsRouter = Router();

// GET /api/events/stream - Authenticated & Company-Isolated Server-Sent Events Endpoint
eventsRouter.get('/stream', (req: Request, res: Response) => {
  const authHeader = req.headers['authorization'];
  const headerToken = typeof authHeader === 'string' && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;
  const cookieToken = req.cookies?.alm_nexus_token || null;
  const queryToken = typeof req.query.token === 'string' ? req.query.token : null;
  const rawToken = headerToken || cookieToken || queryToken;

  if (!rawToken) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Session token required for live stream.' });
  }

  const decoded = verifyToken(rawToken);
  if (!decoded?.id) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Invalid or expired session token.' });
  }

  const requestedCompanyId =
    (typeof req.query.companyId === 'string' && req.query.companyId) ||
    (typeof req.query.tenant_id === 'string' && req.query.tenant_id) ||
    (typeof req.query.tenantId === 'string' && req.query.tenantId) ||
    (req.headers['x-company-id'] as string) ||
    (req.headers['x-tenant-id'] as string) ||
    undefined;

  const memberships = getUserMemberships(decoded.id);
  const membership = requestedCompanyId
    ? memberships.find((m) => m.companyId === requestedCompanyId)
    : memberships[0];

  if (!membership) {
    return res.status(403).json({
      success: false,
      error: 'Forbidden: No active company membership found for requested real-time stream.'
    });
  }

  // Refresh latest departmentIds from DB membership
  const db = getDB();
  const freshMem = (db.companyMemberships || []).find(
    (m: any) => m.userId === decoded.id && m.companyId === membership.companyId
  ) || membership;

  const clientId = `sse_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });

  const client: SSEClient = {
    id: clientId,
    companyId: freshMem.companyId,
    tenantId: freshMem.companyId,
    userId: decoded.id,
    companyRole: freshMem.role,
    departmentIds: Array.isArray(freshMem.departmentIds) ? freshMem.departmentIds : [],
    res,
    connectedAt: new Date().toISOString()
  };

  realtimeEngine.addClient(client);

  const heartbeatTimer = setInterval(() => {
    try {
      res.write(': heartbeat ping\n\n');
    } catch {
      clearInterval(heartbeatTimer);
      realtimeEngine.removeClient(clientId);
    }
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeatTimer);
    realtimeEngine.removeClient(clientId);
  });
});

// GET /api/events/status - Active Connections Status (scoped to user's verified company)
eventsRouter.get('/status', (req: Request, res: Response) => {
  const companyId = (req as any).companyId;
  if (!companyId) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Active company session required.' });
  }
  res.json({
    success: true,
    data: {
      companyConnections: realtimeEngine.getActiveClientCount(companyId),
      companyId,
      timestamp: new Date().toISOString()
    }
  });
});
