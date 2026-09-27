import type { Request, Response, NextFunction } from 'express';

// Simple fixed-window in-memory rate limiter, keyed by client IP.
export function createRateLimiter({ windowMs, max, now = Date.now }: { windowMs: number; max: number; now?: () => number }) {
  const hits = new Map<string, { count: number; resetAt: number }>();

  return function rateLimit(req: Request, res: Response, next: NextFunction) {
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const t = now();
    if (hits.size > 10_000) {
      for (const [k, v] of hits) if (v.resetAt <= t) hits.delete(k);
    }
    const entry = hits.get(key);

    if (!entry || entry.resetAt <= t) {
      hits.set(key, { count: 1, resetAt: t + windowMs });
      return next();
    }

    if (entry.count >= max) {
      res.setHeader('Retry-After', Math.ceil((entry.resetAt - t) / 1000).toString());
      return res.status(429).json({ error: 'Demasiadas peticiones. Inténtalo de nuevo más tarde.' });
    }

    entry.count++;
    next();
  };
}
