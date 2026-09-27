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

// The native app (Capacitor) calls the API from capacitor://localhost (iOS) and
// https://localhost (Android). Only these origins, plus CORS_ORIGINS, get CORS headers.
export const DEFAULT_APP_ORIGINS = ['capacitor://localhost', 'https://localhost'];

export function createCors(allowed: string[]) {
  const origins = new Set(allowed);
  return function cors(req: Request, res: Response, next: NextFunction) {
    const origin = req.get('origin');
    if (origin && origins.has(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
      res.setHeader('Access-Control-Max-Age', '600');
      if (req.method === 'OPTIONS') return res.status(204).end();
    }
    next();
  };
}
