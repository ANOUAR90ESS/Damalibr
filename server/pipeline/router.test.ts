import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import os from 'os';
import path from 'path';
import { createPipelineRouter, requireAdmin, validateCreateJob } from './router';
import { PipelineService } from './service';
import { MemoryJobStore } from './jobs';
import { LocalMediaStore } from './media';

const ROLES: Record<string, string> = { 'admin-token': 'admin', 'user-token': 'user' };
const fakeSupabase = {
  auth: {
    getUser: async (token: string) => (ROLES[token] ? { data: { user: { id: token } }, error: null } : { data: { user: null }, error: new Error('bad') }),
  },
  from: () => ({ select: () => ({ eq: (_c: string, id: string) => ({ maybeSingle: async () => ({ data: { role: ROLES[id] }, error: null }) }) }) }),
} as any;

let server: Server;
let base: string;

beforeAll(async () => {
  const service = new PipelineService({ store: new MemoryJobStore(), media: new LocalMediaStore(path.join(os.tmpdir(), 'lamina-router-test')), ai: null, supabaseAdmin: null });
  const app = express();
  app.use('/secure', createPipelineRouter(service, requireAdmin(fakeSupabase, true)));
  app.use('/dev', createPipelineRouter(service, requireAdmin(null, false)));
  app.use('/prod', createPipelineRouter(service, requireAdmin(null, true)));
  server = app.listen(0);
  await new Promise(r => server.once('listening', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => server.close());

const call = (p: string, init: RequestInit & { token?: string } = {}) =>
  fetch(`${base}${p}`, { ...init, headers: { 'content-type': 'application/json', ...(init.token ? { authorization: `Bearer ${init.token}` } : {}) } });

describe('pipeline access control', () => {
  it('requires an admin session when Supabase is configured', async () => {
    expect((await call('/secure/jobs')).status).toBe(401);
    expect((await call('/secure/jobs', { token: 'forged' })).status).toBe(401);
    expect((await call('/secure/jobs', { token: 'user-token' })).status).toBe(403);
    expect((await call('/secure/jobs', { token: 'admin-token' })).status).toBe(200);
  });

  it('is open in local development and disabled in production without Supabase', async () => {
    expect((await call('/dev/status')).status).toBe(200);
    expect(await (await call('/dev/status')).json()).toEqual({ simulated: true });
    expect((await call('/prod/jobs')).status).toBe(503);
  });
});

describe('pipeline API', () => {
  it('creates a job, rejects out-of-order steps and hides the owner id', async () => {
    const res = await call('/secure/jobs', { method: 'POST', token: 'admin-token', body: JSON.stringify({ title: 'Bodas', author: 'Lorca', source_type: 'custom_text', raw_text: 'NOVIA: Hola.' }) });
    expect(res.status).toBe(201);
    const { job } = await res.json();
    expect(job).toMatchObject({ book_id: 'book-bodas', current_step: 'ingest' });
    expect(job).not.toHaveProperty('created_by');

    expect((await call(`/secure/jobs/${job.id}/steps/render`, { method: 'POST', token: 'admin-token' })).status).toBe(409);
    expect((await call(`/secure/jobs/${job.id}/publish`, { method: 'POST', token: 'admin-token' })).status).toBe(409);
    expect((await call('/secure/jobs/missing', { token: 'admin-token' })).status).toBe(404);

    const started = await call(`/secure/jobs/${job.id}/steps/ingest`, { method: 'POST', token: 'admin-token' });
    expect(started.status).toBe(202);
  });

  it('validates new jobs', () => {
    expect(() => validateCreateJob({ author: 'a', source_type: 'custom_text', raw_text: 'x' })).toThrow(/título/);
    expect(() => validateCreateJob({ title: 't', author: 'a', source_type: 'ftp' })).toThrow(/fuente/);
    expect(() => validateCreateJob({ title: 't', author: 'a', source_type: 'gutenberg' })).toThrow(/URL/);
    expect(() => validateCreateJob({ title: 't', author: 'a', source_type: 'custom_text', raw_text: 'x', drama_episodes: 99 })).toThrow(/entre 1 y 40/);
    expect(validateCreateJob({ title: ' t ', author: 'a', source_type: 'gutenberg', source_url: 'https://www.gutenberg.org/ebooks/1', visual_mode: 'premium' }))
      .toEqual({ title: 't', author: 'a', source_type: 'gutenberg', source_url: 'https://www.gutenberg.org/ebooks/1', visual_mode: 'premium' });
  });
});
