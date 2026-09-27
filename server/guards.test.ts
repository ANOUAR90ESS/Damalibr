import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { createRateLimiter, validateAnalyzeInput } from './guards';

describe('validateAnalyzeInput', () => {
  it('requires a title', () => {
    expect(validateAnalyzeInput({})).toHaveProperty('error');
    expect(validateAnalyzeInput({ title: '   ' })).toHaveProperty('error');
    expect(validateAnalyzeInput(null)).toHaveProperty('error');
  });

  it('rejects non-string fields', () => {
    expect(validateAnalyzeInput({ title: 'Quijote', author: 5 })).toHaveProperty('error');
    expect(validateAnalyzeInput({ title: 'Quijote', rawText: [] })).toHaveProperty('error');
  });

  it('rejects oversized input', () => {
    expect(validateAnalyzeInput({ title: 'x'.repeat(201) })).toHaveProperty('error');
    expect(validateAnalyzeInput({ title: 'Quijote', rawText: 'x'.repeat(200_001) })).toHaveProperty('error');
  });

  it('normalizes valid input', () => {
    expect(validateAnalyzeInput({ title: ' Don Quijote ', author: ' Cervantes ' })).toEqual({
      value: { title: 'Don Quijote', author: 'Cervantes', rawText: '' },
    });
  });
});

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
