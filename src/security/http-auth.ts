import type { Request, Response, NextFunction } from 'express';
import type { AppConfig } from '../config.js';
import { generateRequestId } from './redact.js';

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const id = (req.headers['x-request-id'] as string | undefined) || generateRequestId();
  (req as Request & { requestId: string }).requestId = id;
  res.setHeader('x-request-id', id);
  next();
}

export function createAuthMiddleware(config: AppConfig) {
  const { apiKey, username, password } = config.http;
  const required = Boolean(apiKey || (username && password));

  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.path === '/health/live') {
      next();
      return;
    }
    if (!required) {
      if (config.nodeEnv === 'production' || config.nodeEnv === 'staging') {
        res.status(401).json({
          error: { code: 'AUTHENTICATION_FAILED', message: 'Authentication is required' }
        });
        return;
      }
      next();
      return;
    }

    const header = req.headers.authorization;
    const providedKey = req.headers['x-api-key'];
    if (apiKey && typeof providedKey === 'string' && providedKey === apiKey) {
      next();
      return;
    }
    if (apiKey && header?.startsWith('Bearer ') && header.slice(7) === apiKey) {
      next();
      return;
    }
    if (username && password && header?.startsWith('Basic ')) {
      const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
      const separator = decoded.indexOf(':');
      const user = decoded.slice(0, separator);
      const pass = decoded.slice(separator + 1);
      if (user === username && pass === password) {
        next();
        return;
      }
    }
    res.setHeader('WWW-Authenticate', apiKey ? 'Bearer' : 'Basic realm="aem-mcp"');
    res
      .status(401)
      .json({ error: { code: 'AUTHENTICATION_FAILED', message: 'Authentication required' } });
  };
}

export function hostOriginGuard(config: AppConfig) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const host = req.headers.host;
    if (host && config.http.allowedHosts.length > 0) {
      const hostname = host.split(':')[0] ?? host;
      if (
        !config.http.allowedHosts.includes(hostname) &&
        !config.http.allowedHosts.includes(host)
      ) {
        res.status(403).json({ error: { code: 'POLICY_DENIED', message: 'Invalid Host header' } });
        return;
      }
    }
    const origin = req.headers.origin;
    if (origin && config.http.corsOrigins.length > 0 && !config.http.corsOrigins.includes(origin)) {
      res.status(403).json({ error: { code: 'POLICY_DENIED', message: 'Invalid Origin header' } });
      return;
    }
    next();
  };
}
