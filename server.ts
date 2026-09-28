import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { createCors, createRateLimiter, DEFAULT_APP_ORIGINS } from './server/guards';
import { createPaymentsRouter } from './server/paymentsRouter';
import { hasGeminiKey } from './server/pipeline/common';
import { LocalMediaStore, SupabaseMediaStore } from './server/pipeline/media';
import { MemoryJobStore, SupabaseJobStore } from './server/pipeline/jobs';
import { PipelineService } from './server/pipeline/service';
import { createPipelineRouter, requireAdmin } from './server/pipeline/router';
import { createMediaRouter } from './server/mediaRouter';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';

// CORS for the native app (and any extra origins in CORS_ORIGINS, comma-separated).
app.use('/api', createCors([...DEFAULT_APP_ORIGINS, ...(process.env.CORS_ORIGINS || '').split(',').map(o => o.trim()).filter(Boolean)]));

// Server-side Supabase client with the service role (payments, pipeline, publishing).
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseAdmin = process.env.SUPABASE_SERVICE_ROLE_KEY && supabaseUrl
  ? createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

// Payments: Stripe Checkout + webhook. Mounted before express.json() because the
// webhook needs the raw request body to verify Stripe's signature.
const paymentsDeps = process.env.STRIPE_SECRET_KEY && supabaseAdmin
  ? { stripe: new Stripe(process.env.STRIPE_SECRET_KEY), supabaseAdmin }
  : null;
if (!paymentsDeps) {
  console.warn('Pagos desactivados: faltan STRIPE_SECRET_KEY, SUPABASE_SERVICE_ROLE_KEY o SUPABASE_URL.');
}
app.use('/api/checkout', createRateLimiter({ windowMs: 60_000, max: 10 }));
app.use('/api', createPaymentsRouter(paymentsDeps, process.env.STRIPE_WEBHOOK_SECRET));

// Protected media gateway. In Supabase mode it issues a 2-minute signed URL.
// In local development it reads from MEDIA_DIR. The legacy /media static route
// is intentionally not exposed when Supabase is configured.
const localMediaDir = process.env.MEDIA_DIR || path.join(__dirname, 'data', 'media');
const mediaStore = supabaseAdmin
  ? new SupabaseMediaStore(supabaseAdmin)
  : new LocalMediaStore(localMediaDir);
app.use('/api/media', createMediaRouter(mediaStore, supabaseAdmin, isProduction));

// AI production pipeline (admins only). Without a Gemini key it runs in simulated mode;
// without Supabase it keeps jobs in memory and media on local disk.
const pipeline = new PipelineService({
  store: supabaseAdmin ? new SupabaseJobStore(supabaseAdmin) : new MemoryJobStore(),
  media: mediaStore,
  ai: hasGeminiKey()
    ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { headers: { 'User-Agent': 'aistudio-build' } } })
    : null,
  supabaseAdmin,
  ffmpeg: process.env.FFMPEG_PATH,
});
if (pipeline.simulated) console.warn('Estudio IA en modo simulado: falta GEMINI_API_KEY.');

const pipelineLimiter = createRateLimiter({ windowMs: 60_000, max: 30 });
app.use('/api/pipeline', (req, res, next) => (req.method === 'GET' ? next() : pipelineLimiter(req, res, next)));
app.use('/api/pipeline', createPipelineRouter(pipeline, requireAdmin(supabaseAdmin, isProduction)));

app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: 'Lámina', timestamp: new Date().toISOString() });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Lámina full-stack server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
