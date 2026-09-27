# LÁMINA - Plataforma de Microdramas de Libros Clásicos

**LÁMINA** es una aplicación móvil (construida con React, TypeScript, Tailwind, Zustand y preparada para empaquetado nativo con Capacitor) que adapta obras maestras en dominio público de la literatura clásica a **microdramas verticales en 9:16**, **cortometrajes cinematográficos en 16:9** y **video-resúmenes de 5 a 10 minutos**.

---

## Requisitos y comandos

Este repositorio usa exclusivamente **Bun 1.2.14** como gestor de paquetes. La versión está fijada en `package.json` y el lockfile `bun.lock` utiliza el formato compatible con esa versión. Usa Node.js **22.12.0 o posterior** para ejecutar las herramientas del proyecto.

```bash
# Instalar exactamente las dependencias del lockfile (instalación limpia/CI)
bun install --frozen-lockfile

# Desarrollo local: servidor Express + Vite en middleware (http://localhost:3000)
bun run dev

# Solo el frontend con Vite, sin la API /api/*
bun run dev:client

# Validación de tipos/lint
bun run lint

# Tests unitarios (Vitest)
bun run test

# Build de producción (frontend en dist/ + servidor en server.js)
bun run build

# Arrancar en producción tras el build
bun run start
```

La API `/api/pipeline/*` valida el cuerpo de la petición y tiene un límite de 10 peticiones por minuto por IP (`server/guards.ts`).

Para actualizar dependencias de forma intencionada, ejecuta `bun install` con Bun 1.2.14 y confirma el cambio resultante en `bun.lock`. No uses `npm install`, `yarn` ni `pnpm`, ya que generarían lockfiles alternativos.

---

## 🚀 Arquitectura y Stack Tecnológico

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS v4.
- **Enrutamiento**: React Router v7 con arquitectura modular por características (`/src/features/*`).
- **Gestión de Estado**: Zustand (`useAuthStore`, `useCatalogStore`, `usePlayerStore`, `useWalletStore`, `useLibraryStore`, `usePipelineStore`). Con Supabase configurado, el catálogo, el perfil, la biblioteca, el progreso y los «me gusta» se sincronizan con la base de datos; sin Supabase la app funciona en modo demo local con LocalStorage.
- **Reproducción de Video**: HLS.js con soporte adaptive bitrate y motor alternativo cinemático Ken Burns con subtítulos sincronizados por personaje y emoción.
- **Backend / Pipeline IA**: Express + `@google/genai` (Gemini 3.8 Flash) en servidor para análisis dramatúrgico, extracción de personajes y generación de guiones con cliffhangers.
- **Base de Datos & Auth**: Supabase (PostgreSQL, Row Level Security, Storage, Auth con Google y Email).

---

## 📖 Modelo de Datos

1. **`books`**: `id`, `title`, `author`, `year`, `language`, `cover_url`, `backdrop_url`, `synopsis`, `source_text_url`, `genres[]`, `era`, `status`, `rating`, `total_views`.
2. **`characters`**: `id`, `book_id`, `name`, `description`, `role`, `personality`, `gender`, `age_range`, `voice_id`, `voice_name`, `avatar_url`.
3. **`adaptations`**: `id`, `book_id`, `format` ('drama' | 'film' | 'summary'), `status`, `total_duration`, `episode_count`, `aspect_ratio`.
4. **`episodes`**: `id`, `adaptation_id`, `book_id`, `number`, `title`, `script_json`, `video_url`, `duration`, `is_free`, `coin_price`, `story_position_start`, `story_position_end`, `cliffhanger`.
5. **`user_progress`**: `user_id`, `book_id`, `adaptation_id`, `episode_id`, `seconds`, `completed`, `updated_at`.
6. **`library`**: `user_id`, `book_id`, `state` ('to_watch' | 'started' | 'finished'), `is_bookmarked`, `is_downloaded`, `download_size_mb`.
7. **`subscriptions`**: `user_id`, `tier` ('free' | 'vip'), `status`, `current_period_end`.
8. **`coin_wallet`** & **`transactions`**: saldo de monedas, compras, desbloqueo de episodios.
9. **`views`**: registro temporal para rankings por día, semana, mes y año.
10. **`profiles`**: rachas, metas de lectura en minutos y control parental con PIN de 4 dígitos.

---

## 🎬 5 Clásicos Españoles en Dominio Público (Seed Data)

1. **Don Quijote de la Mancha** (Miguel de Cervantes, 1605)
2. **La Celestina** (Fernando de Rojas, 1499)
3. **La Regenta** (Leopoldo Alas «Clarín», 1884)
4. **Fortunata y Jacinta** (Benito Pérez Galdós, 1887)
5. **Rimas y Leyendas** (Gustavo Adolfo Bécquer, 1871)

Cada obra incluye personajes con roles y voces asignadas, y 3 formatos adaptados con posiciones de historia equivalentes.

---

## 🛠️ Pipeline de Producción de IA (Admin)

Disponible en la pestaña **/studio** (`Estudio IA`). Con Supabase configurado solo pueden usarlo los administradores (`profiles.role = 'admin'`); el servidor lo comprueba en cada petición a `/api/pipeline/*`. En modo demo local (sin Supabase) está abierto en desarrollo y desactivado en producción.

Cada paso se ejecuta en el servidor (`server/pipeline/`) y la pantalla consulta el progreso:

1. **Ingesta** (`ingest.ts`): texto pegado o URL de Project Gutenberg / Wikisource (solo esos dominios, https y redirecciones verificadas). Elimina la licencia de Gutenberg y el marcado wiki, y segmenta por capítulos, actos o jornadas.
2. **Análisis** (`analyze.ts`): Gemini extrae personajes (rol, personalidad, género, edad), sinopsis, géneros, época y año, y asigna a cada personaje una voz TTS distinta.
3. **Guiones** (`adapt.ts`): microdrama 9:16 (1–40 episodios con cliffhanger; los 5 primeros gratis, el resto 10 monedas), cortometraje 16:9 (25 monedas) y video-resumen narrado (gratis), con `story_position` continuas para el conmutador de formatos.
4. **Voces** (`voices.ts`): audio WAV por línea con la voz del personaje y el tono de la emoción (Gemini TTS).
5. **Visuales** (`visuals.ts`): portada, fondo y una imagen por escena (Imagen). El modo premium con Veo aún no está implementado y usa el económico.
6. **Render** (`render.ts`): FFmpeg compone cada escena con efecto Ken Burns y su audio, quema subtítulos con el nombre del personaje y genera MP4 + HLS (720p, segmentos de 4 s) y miniatura.
7. **Revisión y publicación** (`publish.ts`): el admin revisa los vídeos y al aprobar se escriben libro, personajes, adaptaciones y episodios en el catálogo.

**Modo simulado:** sin `GEMINI_API_KEY` el pipeline funciona igualmente: los personajes salen de los diálogos (`NOMBRE: texto`), los guiones usan frases del propio texto, no hay voces ni imágenes, y el render produce vídeos reales con subtítulos sobre fondo liso. Sirve para probar el flujo completo sin coste.

**Almacenamiento:** con Supabase, los trabajos se guardan en `pipeline_jobs` (sin acceso desde el cliente) y los medios en el bucket público `media` de Supabase Storage (migración `20260929000000_pipeline.sql`). Sin Supabase, los trabajos viven en memoria y los medios en `data/media/` (servidos en `/media`).

**Requisitos del servidor:** FFmpeg con `libass` instalado (`apt-get install ffmpeg`, o `FFMPEG_PATH`). Los pasos se ejecutan en segundo plano dentro del proceso del servidor: en plataformas que pausan la CPU entre peticiones (p. ej. Cloud Run) activa "CPU always allocated" o usa una instancia dedicada. Si el servidor se reinicia a mitad de un paso, el trabajo aparece como fallido y se puede reintentar.

Modelos configurables: `GEMINI_TEXT_MODEL` (por defecto `gemini-3.8-flash`), `GEMINI_TTS_MODEL` (`gemini-3.1-flash-tts-preview`) y `GEMINI_IMAGE_MODEL` (`imagen-4.0-generate-001`).

---

## 📱 Empaquetado Móvil con Capacitor

Para generar la app nativa en iOS o Android:

```bash
# 1. Instalar Capacitor
npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios

# 2. Inicializar el proyecto Capacitor
npx cap init "Lámina" "com.lamina.app" --web-dir dist

# 3. Compilar la aplicación web
npm run build

# 4. Añadir plataformas nativas
npx cap add android
npx cap add ios

# 5. Sincronizar y abrir en Android Studio / Xcode
npx cap sync
npx cap open android
```

---

## ⚙️ Configuración y Variables de Entorno

Revisa `.env.example`:
```env
GEMINI_API_KEY="tu-clave-gemini"
VITE_SUPABASE_URL="https://tu-proyecto.supabase.co"
VITE_SUPABASE_ANON_KEY="tu-anon-key"
```

Sin `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` la app arranca en **modo demo local** (sin cuentas reales, datos en LocalStorage).

### Supabase

- Esquema + RLS: `supabase/migrations/20260927000000_init.sql`. Cada usuario nuevo recibe automáticamente perfil, suscripción gratuita y 60 monedas de bienvenida (trigger `on_auth_user_created`).
- Catálogo inicial: `supabase/seed.sql`, generado desde `src/data/seedBooks.ts` con `bun run db:seed` (un test falla si queda desactualizado).
- Los usuarios solo pueden leer/escribir sus propios datos. Monedas, transacciones y suscripciones son de solo lectura desde el cliente, y el campo `profiles.role` solo lo puede cambiar el service role.

Desarrollo local con la [CLI de Supabase](https://supabase.com/docs/guides/local-development):

```bash
supabase init        # solo la primera vez (crea supabase/config.toml)
supabase start       # aplica migraciones + seed; muestra la URL y la anon key
# Copia API URL y anon key en .env como VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
```

Proyecto en la nube: `supabase link --project-ref <ref>` y `supabase db push`, y después ejecuta `supabase/seed.sql` en el SQL Editor. Para el login activa los proveedores **Email** y **Google** en *Authentication → Providers* y añade `https://tu-dominio/profile` a las *Redirect URLs*.

Para dar acceso de administrador a un usuario:

```sql
update public.profiles set role = 'admin' where id = '<uuid del usuario>';
```

### Pagos con Stripe (monedas y VIP)

La economía se valida en el servidor (migración `supabase/migrations/20260928000000_economy.sql`):

- **Desbloqueo de episodios**: RPC `unlock_episode` — comprueba saldo, VIP y episodios gratuitos, descuenta monedas y registra la transacción de forma atómica.
- **Compras de monedas y VIP**: `POST /api/checkout` crea una sesión de Stripe Checkout con los precios de `src/lib/products.ts` (el cliente solo envía el id del producto). El webhook `POST /api/stripe/webhook` verifica la firma y acredita las monedas (una sola vez por sesión) o activa/renueva/cancela el VIP.
- **Gestionar/cancelar VIP**: `POST /api/billing-portal` abre el portal de cliente de Stripe.
- **PIN parental**: se guarda con bcrypt en `kids_pins` (sin acceso desde el cliente) y se comprueba con la RPC `set_kids_mode`; tras 5 intentos fallidos se bloquea 5 minutos. Sin Supabase, el PIN se guarda como hash SHA-256 con sal en el dispositivo.

Configuración:

1. Aplica las migraciones (`supabase db push`).
2. En Stripe (modo test), copia la **Secret key** en `STRIPE_SECRET_KEY`. No hace falta crear productos: los precios se envían en cada sesión.
3. Crea un webhook apuntando a `https://tu-dominio/api/stripe/webhook` con los eventos `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `customer.subscription.created`, `customer.subscription.updated` y `customer.subscription.deleted`, y copia su *signing secret* en `STRIPE_WEBHOOK_SECRET`. En local: `stripe listen --forward-to localhost:3000/api/stripe/webhook`.
4. Copia la *service role key* de Supabase en `SUPABASE_SERVICE_ROLE_KEY` (solo en el servidor) y define `APP_URL` con la URL pública de la app.
5. Activa el portal de cliente en *Stripe → Settings → Billing → Customer portal*.

Tarjeta de prueba: `4242 4242 4242 4242`, cualquier fecha futura y CVC. Si faltan las claves, las rutas de pago responden 503 y la app lo indica al usuario; en modo demo local las compras siguen siendo simuladas.
