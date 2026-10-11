import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface LogPayload {
  timestamp: string;
  level: LogLevel;
  message: string;
  traceId?: string;
  tenantId?: string;
  userId?: string;
  context?: string;
  details?: any;
  durationMs?: number;
}

class StructuredLogger {
  private formatLog(payload: LogPayload): string {
    return JSON.stringify({
      timestamp: payload.timestamp,
      level: payload.level.toUpperCase(),
      message: payload.message,
      traceId: payload.traceId || 'trace-system',
      tenantId: payload.tenantId || 'tenant-global',
      userId: payload.userId || 'system',
      context: payload.context || 'app',
      ...(payload.details ? { details: payload.details } : {}),
      ...(payload.durationMs !== undefined ? { durationMs: payload.durationMs } : {})
    });
  }

  public info(message: string, meta: Partial<LogPayload> = {}): void {
    console.log(this.formatLog({
      timestamp: new Date().toISOString(),
      level: 'info',
      message,
      ...meta
    }));
  }

  public warn(message: string, meta: Partial<LogPayload> = {}): void {
    console.warn(this.formatLog({
      timestamp: new Date().toISOString(),
      level: 'warn',
      message,
      ...meta
    }));
  }

  public error(message: string, meta: Partial<LogPayload> = {}): void {
    console.error(this.formatLog({
      timestamp: new Date().toISOString(),
      level: 'error',
      message,
      ...meta
    }));
  }

  public debug(message: string, meta: Partial<LogPayload> = {}): void {
    if (process.env.LOG_LEVEL === 'debug' || process.env.NODE_ENV !== 'production') {
      console.log(this.formatLog({
        timestamp: new Date().toISOString(),
        level: 'debug',
        message,
        ...meta
      }));
    }
  }
}

export const logger = new StructuredLogger();

// Express correlation ID & HTTP access logging middleware
export function requestCorrelationMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incomingTraceId = req.headers['x-correlation-id'] || req.headers['x-trace-id'];
  const traceId = typeof incomingTraceId === 'string' && incomingTraceId.trim().length > 0
    ? incomingTraceId.trim()
    : `trace-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

  (req as any).traceId = traceId;
  res.setHeader('X-Correlation-ID', traceId);

  const start = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - start;
    const tenantId = (req as any).tenant_id || (req as any).tenantId || 'tenant-alm-nexus';
    const userId = (req as any).user?.id || 'anonymous';
    const url = req.originalUrl || req.url;

    // Suppress verbose Vite HMR & source file asset logs from console output
    const isViteAsset = url.startsWith('/src/') ||
                        url.startsWith('/@vite/') ||
                        url.startsWith('/@id/') ||
                        url.startsWith('/node_modules/') ||
                        /\.(tsx|ts|jsx|js|css|svg|png|jpg|jpeg|gif|ico|woff|woff2)\b/.test(url);

    if (isViteAsset) {
      return;
    }

    logger.info(`HTTP ${req.method} ${url} ${res.statusCode} - ${durationMs}ms`, {
      traceId,
      tenantId,
      userId,
      context: 'HTTP',
      durationMs,
      details: {
        method: req.method,
        url,
        statusCode: res.statusCode,
        ip: req.ip || '127.0.0.1',
        userAgent: req.headers['user-agent']
      }
    });
  });

  next();
}
