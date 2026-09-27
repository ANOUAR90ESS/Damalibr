import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { createRateLimiter, validateAnalyzeInput } from './server/guards';
import { createPaymentsRouter } from './server/paymentsRouter';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Payments: Stripe Checkout + webhook. Mounted before express.json() because the
// webhook needs the raw request body to verify Stripe's signature.
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const paymentsDeps =
  process.env.STRIPE_SECRET_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY && supabaseUrl
    ? {
        stripe: new Stripe(process.env.STRIPE_SECRET_KEY),
        supabaseAdmin: createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY, {
          auth: { persistSession: false, autoRefreshToken: false },
        }),
      }
    : null;
if (!paymentsDeps) {
  console.warn('Pagos desactivados: faltan STRIPE_SECRET_KEY, SUPABASE_SERVICE_ROLE_KEY o SUPABASE_URL.');
}
app.use('/api/checkout', createRateLimiter({ windowMs: 60_000, max: 10 }));
app.use('/api', createPaymentsRouter(paymentsDeps, process.env.STRIPE_WEBHOOK_SECRET));

app.use(express.json({ limit: '1mb' }));

// Protect the Gemini-backed pipeline endpoints from abuse
app.use('/api/pipeline', createRateLimiter({ windowMs: 60_000, max: 10 }));

// Initialize Google GenAI on server
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// API: Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: 'Lámina', timestamp: new Date().toISOString() });
});

// API: Pipeline Analyze Book using Gemini
app.post('/api/pipeline/analyze', async (req, res) => {
  try {
    const validation = validateAnalyzeInput(req.body);
    if ('error' in validation) {
      return res.status(400).json({ error: validation.error });
    }
    const { title, author, rawText } = validation.value;

    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'MY_GEMINI_API_KEY') {
      // Fallback simulated response if no API key yet
      return res.json({
        characters: [
          {
            id: `char-${Date.now()}-1`,
            book_id: 'book-pipeline',
            name: 'Protagonista Principal',
            description: `Personaje central de ${title}.`,
            role: 'protagonista',
            personality: 'Decidido, elocuente y noble',
            gender: 'masculino',
            age_range: '30-35 años',
            voice_id: 'voice-fenrir',
            voice_name: 'Fenrir (Voz profunda)',
            avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80'
          },
          {
            id: `char-${Date.now()}-2`,
            book_id: 'book-pipeline',
            name: 'Antagonista',
            description: `Rival que desafía el orden en ${title}.`,
            role: 'antagonista',
            personality: 'Calculador e implacable',
            gender: 'masculino',
            age_range: '40-45 años',
            voice_id: 'voice-charon',
            voice_name: 'Charon (Voz áspera)',
            avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80'
          }
        ]
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `Analiza la siguiente obra clásica en dominio público y extrae los personajes principales y secundarios con su nombre, rol (protagonista, antagonista, secundario), personalidad, edad aproximada y voz recomendada.
Obra: "${title}" de ${author}.
Texto inicial / fragmento:
${rawText.slice(0, 3000)}`,
      config: {
        systemInstruction: "Eres un dramaturgista experto en adaptar literatura clásica española a microdramas verticales 9:16.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            characters: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  description: { type: Type.STRING },
                  role: { type: Type.STRING },
                  personality: { type: Type.STRING },
                  gender: { type: Type.STRING },
                  age_range: { type: Type.STRING },
                  voice_name: { type: Type.STRING }
                },
                required: ['name', 'description', 'role', 'personality', 'gender', 'age_range']
              }
            }
          },
          required: ['characters']
        }
      }
    });

    const parsed = JSON.parse(response.text || '{}');
    const enriched = (parsed.characters || []).map((c: any, i: number) => ({
      ...c,
      id: `char-ai-${i + 1}`,
      book_id: 'book-pipeline',
      voice_id: `voice-${c.name.toLowerCase().replace(/\s+/g, '-')}`,
      voice_name: c.voice_name || 'Fenrir (Voz clásica)',
      avatar_url: `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(c.name)}`
    }));

    return res.json({ characters: enriched });
  } catch (error: any) {
    console.error('Pipeline analyze error:', error);
    res.status(500).json({ error: error.message || 'Error en el análisis de personajes' });
  }
});

// Setup Vite in Dev or Serve Static in Prod
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
