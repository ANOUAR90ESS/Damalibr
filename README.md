# LÁMINA - Plataforma de Microdramas de Libros Clásicos

**LÁMINA** es una aplicación móvil (construida con React, TypeScript, Tailwind, Zustand y preparada para empaquetado nativo con Capacitor) que adapta obras maestras en dominio público de la literatura clásica a **microdramas verticales en 9:16**, **cortometrajes cinematográficos en 16:9** y **video-resúmenes de 5 a 10 minutos**.

---

## Requisitos y comandos

Este repositorio usa exclusivamente **Bun 1.2.14** como gestor de paquetes. La versión está fijada en `package.json` y el lockfile `bun.lock` utiliza el formato compatible con esa versión. Usa Node.js **22.12.0 o posterior** para ejecutar las herramientas del proyecto.

```bash
# Instalar exactamente las dependencias del lockfile (instalación limpia/CI)
bun install --frozen-lockfile

# Desarrollo local (http://localhost:3000)
bun run dev

# Validación de tipos/lint
bun run lint

# Build de producción
bun run build
```

Para actualizar dependencias de forma intencionada, ejecuta `bun install` con Bun 1.2.14 y confirma el cambio resultante en `bun.lock`. No uses `npm install`, `yarn` ni `pnpm`, ya que generarían lockfiles alternativos.

---

## 🚀 Arquitectura y Stack Tecnológico

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS v4.
- **Enrutamiento**: React Router v7 con arquitectura modular por características (`/src/features/*`).
- **Gestión de Estado**: Zustand con persistencia en LocalStorage (`useAuthStore`, `usePlayerStore`, `useWalletStore`, `useLibraryStore`, `usePipelineStore`).
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

Disponible en la pestaña **/studio** (`Estudio IA`):
1. **Ingest**: Limpieza y segmentación de capítulos desde Project Gutenberg o Wikisource.
2. **Analyze**: Extracción con Gemini de personajes (nombre, psicología, edad, género) y arco dramático.
3. **Adapt**:
   - **Microdrama**: 15–40 episodios (1–3 min) con diálogo real entre personajes y cliffhangers.
   - **Corto**: Guión cinematográfico de 10–20 min.
   - **Resumen**: Video-resumen de 5–10 min guiado por narrador.
   - Sincronización de `story_position` para el conmutador de formatos.
4. **Voices**: Asignación de voces de actores TTS con inflexión de emoción (ira, desgarro, súplica).
5. **Visuals**: Selector de modo económico (Imágenes IA + Ken Burns + subtítulos) vs premium (Veo Text-to-Video).
6. **Render**: Ensamblado con FFmpeg en 9:16 y 16:9, subtítulos quemados y salida HLS.
7. **Human Review**: Validación y publicación directa al catálogo de Lámina.

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

El script SQL completo con RLS se encuentra en `src/lib/supabase-schema.sql`.
