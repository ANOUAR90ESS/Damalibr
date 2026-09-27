export interface Chapter {
  title: string;
  text: string;
}

// Only public-domain libraries can be fetched, so the server cannot be used to
// reach arbitrary (e.g. internal) URLs.
const ALLOWED_HOSTS = [/(^|\.)gutenberg\.org$/i, /(^|\.)wikisource\.org$/i];
const MAX_SOURCE_BYTES = 8 * 1024 * 1024;

export function assertAllowedSourceUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('URL de origen inválida.');
  }
  if (url.protocol !== 'https:') throw new Error('La URL de origen debe usar https.');
  if (!ALLOWED_HOSTS.some(re => re.test(url.hostname))) {
    throw new Error('Solo se admiten textos de Project Gutenberg o Wikisource.');
  }
  return url;
}

// Turns an ebook page URL (https://www.gutenberg.org/ebooks/2000) into its plain-text file.
export function resolveGutenbergTextUrl(url: URL): URL {
  const m = url.pathname.match(/^\/ebooks\/(\d+)\/?$/);
  if (/(^|\.)gutenberg\.org$/i.test(url.hostname) && m) {
    return new URL(`https://www.gutenberg.org/cache/epub/${m[1]}/pg${m[1]}.txt`);
  }
  return url;
}

// Wikisource pages are fetched as plain text through the MediaWiki "raw" action.
function resolveWikisourceUrl(url: URL): URL {
  const m = url.pathname.match(/^\/wiki\/(.+)$/);
  if (/(^|\.)wikisource\.org$/i.test(url.hostname) && m) {
    return new URL(`https://${url.hostname}/w/index.php?title=${m[1]}&action=raw`);
  }
  return url;
}

export async function fetchSourceText(rawUrl: string, fetchImpl: typeof fetch = fetch): Promise<string> {
  let url = resolveWikisourceUrl(resolveGutenbergTextUrl(assertAllowedSourceUrl(rawUrl)));
  let res: Response | undefined;
  // Follow a few redirects manually so every hop is checked against the allowlist.
  for (let hop = 0; hop <= 3; hop++) {
    res = await fetchImpl(url, { redirect: 'manual', signal: AbortSignal.timeout(30_000) });
    const location = res.status >= 300 && res.status < 400 ? res.headers.get('location') : null;
    if (!location) break;
    url = assertAllowedSourceUrl(new URL(location, url).toString());
    res = undefined;
  }
  if (!res) throw new Error('Demasiadas redirecciones al descargar el texto.');
  if (!res.ok) throw new Error(`No se pudo descargar el texto (${res.status}).`);
  const length = Number(res.headers.get('content-length') || 0);
  if (length > MAX_SOURCE_BYTES) throw new Error('El texto es demasiado grande.');
  const text = await res.text();
  if (text.length > MAX_SOURCE_BYTES) throw new Error('El texto es demasiado grande.');
  return text;
}

// Strips the Project Gutenberg licence header/footer and wiki markup, and normalizes whitespace.
export function cleanSourceText(text: string): string {
  let out = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');

  const start = out.search(/^\*{3}\s*START OF (THE|THIS) PROJECT GUTENBERG EBOOK.*$/im);
  if (start >= 0) out = out.slice(out.indexOf('\n', start) + 1);
  const end = out.search(/^\*{3}\s*END OF (THE|THIS) PROJECT GUTENBERG EBOOK.*$/im);
  if (end >= 0) out = out.slice(0, end);

  out = out
    .replace(/\{\{[^{}]*\}\}/g, '') // wiki templates
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '') // footnotes
    .replace(/<[^>]+>/g, '') // html tags
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, '$1') // wiki links
    .replace(/'''?/g, '')
    .replace(/\[\d+\]/g, ''); // numeric footnote markers

  return out
    .split('\n')
    .map(l => l.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const HEADING = /^(?:(?:cap[ií]tulo|chapter|acto|act|canto|parte|libro|jornada|escena|tratado)\b[^\n]{0,80}|[IVXLCDM]{1,7}\.?|==+[^=\n]+==+)$/i;
const TARGET_CHUNK = 12_000;

// Splits a cleaned text into chapters using common headings (CAPÍTULO, ACTO, roman
// numerals, wiki "== x =="). Falls back to ~12k-character chunks on paragraph breaks.
export function segmentChapters(text: string): Chapter[] {
  const lines = text.split('\n');
  const chapters: Chapter[] = [];
  let current: { title: string; lines: string[] } | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && HEADING.test(trimmed)) {
      if (current && current.lines.join('\n').trim()) {
        chapters.push({ title: current.title, text: current.lines.join('\n').trim() });
      }
      current = { title: trimmed.replace(/^=+\s*|\s*=+$/g, ''), lines: [] };
    } else {
      if (!current) current = { title: 'Inicio', lines: [] };
      current.lines.push(line);
    }
  }
  if (current && current.lines.join('\n').trim()) {
    chapters.push({ title: current.title, text: current.lines.join('\n').trim() });
  }

  // Tiny preface before the first real heading is merged into it.
  if (chapters.length > 1 && chapters[0].title === 'Inicio' && chapters[0].text.length < 500) {
    chapters[1] = { title: chapters[1].title, text: `${chapters[0].text}\n\n${chapters[1].text}` };
    chapters.shift();
  }

  if (chapters.length >= 2) return chapters;
  return chunkByParagraphs(text);
}

function chunkByParagraphs(text: string): Chapter[] {
  const paragraphs = text.split(/\n\s*\n/);
  const chunks: Chapter[] = [];
  let buf = '';
  for (const p of paragraphs) {
    if (buf && buf.length + p.length > TARGET_CHUNK) {
      chunks.push({ title: `Parte ${chunks.length + 1}`, text: buf.trim() });
      buf = '';
    }
    buf += `${p}\n\n`;
  }
  if (buf.trim()) chunks.push({ title: `Parte ${chunks.length + 1}`, text: buf.trim() });
  return chunks;
}
