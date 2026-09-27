import type { Request, Response, NextFunction } from 'express';

export interface AnalyzeInput {
  title: string;
  author: string;
  rawText: string;
}

const MAX_TITLE_LENGTH = 200;
const MAX_AUTHOR_LENGTH = 200;
const MAX_RAW_TEXT_LENGTH = 200_000;

// Validates the body of /api/pipeline/analyze. Returns an error message or the normalized input.
export function validateAnalyzeInput(body: unknown): { error: string } | { value: AnalyzeInput } {
  if (!body || typeof body !== 'object') {
    return { error: 'Cuerpo de la petición inválido.' };
  }
  const { title, author, rawText } = body as Record<string, unknown>;

  if (typeof title !== 'string' || !title.trim()) {
    return { error: 'El campo "title" es obligatorio.' };
  }
  if (title.length > MAX_TITLE_LENGTH) {
    return { error: `"title" no puede superar ${MAX_TITLE_LENGTH} caracteres.` };
  }
  if (author !== undefined && typeof author !== 'string') {
    return { error: '"author" debe ser texto.' };
  }
  if (typeof author === 'string' && author.length > MAX_AUTHOR_LENGTH) {
    return { error: `"author" no puede superar ${MAX_AUTHOR_LENGTH} caracteres.` };
  }
  if (rawText !== undefined && typeof rawText !== 'string') {
    return { error: '"rawText" debe ser texto.' };
  }
  if (typeof rawText === 'string' && rawText.length > MAX_RAW_TEXT_LENGTH) {
    return { error: `"rawText" no puede superar ${MAX_RAW_TEXT_LENGTH} caracteres.` };
  }

  return {
    value: {
      title: title.trim(),
      author: typeof author === 'string' ? author.trim() : '',
      rawText: typeof rawText === 'string' ? rawText : '',
    },
  };
}

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
