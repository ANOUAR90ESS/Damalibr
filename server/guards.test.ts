import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { createCors, createRateLimiter } from './guards';

describe('createRateLimiter', () => {
  function mockRes() {
    const res = { statusCode: 200, headers: {} as Record<string, string>, body: undefined as unknown } as any;
    res.status = (code: number) => { res.statusCode = code; return res; };
    res.json = (body: unknown) => { res.body = body; return res; };
    res.setHeader = (k: string, v: string) => { res.headers[k] = v; };
    return res as Response & { statusCode: number; headers: Record<string, string> };
  }
  const req = (ip: string) => ({ ip, socket: {} }) as unknown as Request;

  it('blocks requests over the limit and resets after the window', () => {
    let t = 0;
    const limiter = createRateLimiter({ windowMs: 1000, max: 2, now: () => t });
    const next = vi.fn();

    limiter(req('1.1.1.1'), mockRes(), next);
    limiter(req('1.1.1.1'), mockRes(), next);
    const blocked = mockRes();
    limiter(req('1.1.1.1'), blocked, next);

    expect(next).toHaveBeenCalledTimes(2);
    expect(blocked.statusCode).toBe(429);
    expect(blocked.headers['Retry-After']).toBe('1');

    // Other clients are unaffected
    limiter(req('2.2.2.2'), mockRes(), next);
    expect(next).toHaveBeenCalledTimes(3);

    t = 1000;
    limiter(req('1.1.1.1'), mockRes(), next);
    expect(next).toHaveBeenCalledTimes(4);
  });
});

describe('createCors', () => {
  const run = (origin: string | undefined, method = 'GET') => {
    const headers: Record<string, string> = {};
    const res = { statusCode: 200, setHeader: (k: string, v: string) => { headers[k] = v; }, status(c: number) { this.statusCode = c; return this; }, end: vi.fn() } as any;
    const next = vi.fn();
    createCors(['capacitor://localhost'])({ get: () => origin, method } as unknown as Request, res, next);
    return { headers, res, next };
  };

  it('allows the native app origin and answers preflight requests', () => {
    expect(run('capacitor://localhost').headers['Access-Control-Allow-Origin']).toBe('capacitor://localhost');
    const pre = run('capacitor://localhost', 'OPTIONS');
    expect(pre.res.statusCode).toBe(204);
    expect(pre.next).not.toHaveBeenCalled();
  });

  it('adds no CORS headers for other origins', () => {
    const other = run('https://evil.example');
    expect(other.headers).toEqual({});
    expect(other.next).toHaveBeenCalled();
  });
});
