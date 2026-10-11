import { Request, Response, Router } from 'express';
import { logger } from '../logger';

export interface SSEClient {
  id: string;
  tenantId: string;
  userId: string;
  res: Response;
  connectedAt: string;
}

class RealtimeBroadcaster {
  private clients: Map<string, SSEClient> = new Map();

  public addClient(client: SSEClient): void {
    this.clients.set(client.id, client);
    logger.info(`SSE Client connected: ${client.id} (Tenant: ${client.tenantId})`, {
      context: 'RealtimeSSE',
      tenantId: client.tenantId,
      userId: client.userId
    });

    // Send initial handshake SSE message
    this.sendToClient(client.id, 'connected', {
      clientId: client.id,
      tenantId: client.tenantId,
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
        tenantId: client.tenantId
      });
    }
  }

  public broadcastToTenant(tenantId: string, eventName: string, data: any): void {
    let deliveredCount = 0;
    this.clients.forEach((client, id) => {
      if (client.tenantId === tenantId || tenantId === 'tenant-global' || client.tenantId === 'tenant-alm-nexus') {
        this.sendToClient(id, eventName, data);
        deliveredCount++;
      }
    });

    logger.debug(`Broadcasted event "${eventName}" to ${deliveredCount} clients in tenant ${tenantId}`, {
      context: 'RealtimeSSE',
      tenantId
    });
  }

  public sendToClient(clientId: string, eventName: string, data: any): boolean {
    const client = this.clients.get(clientId);
    if (!client) return false;

    try {
      client.res.write(`event: ${eventName}\n`);
      client.res.write(`data: ${JSON.stringify(data)}\n\n`);
      return true;
    } catch (err) {
      this.removeClient(clientId);
      return false;
    }
  }

  public getActiveClientCount(tenantId?: string): number {
    if (!tenantId) return this.clients.size;
    let count = 0;
    this.clients.forEach((c) => {
      if (c.tenantId === tenantId) count++;
    });
    return count;
  }
}

export const realtimeEngine = new RealtimeBroadcaster();

export const eventsRouter = Router();

// GET /api/events/stream - Server-Sent Events Endpoint
eventsRouter.get('/stream', (req: Request, res: Response) => {
  const tenantId = (req as any).tenant_id || (req.query.tenant_id as string) || 'tenant-alm-nexus';
  const userId = (req as any).user?.id || (req.query.user_id as string) || 'user-anon';
  const clientId = `sse_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  // SSE mandatory headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });

  const client: SSEClient = {
    id: clientId,
    tenantId,
    userId,
    res,
    connectedAt: new Date().toISOString()
  };

  realtimeEngine.addClient(client);

  // Keep-alive heartbeat ping every 25 seconds
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

// GET /api/events/status - Active Connections Status
eventsRouter.get('/status', (req: Request, res: Response) => {
  const tenantId = (req as any).tenant_id || 'tenant-alm-nexus';
  res.json({
    success: true,
    data: {
      activeConnections: realtimeEngine.getActiveClientCount(),
      tenantConnections: realtimeEngine.getActiveClientCount(tenantId),
      tenantId,
      timestamp: new Date().toISOString()
    }
  });
});
