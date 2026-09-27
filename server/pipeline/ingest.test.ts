import { describe, expect, it, vi } from 'vitest';
import { assertAllowedSourceUrl, cleanSourceText, fetchSourceText, resolveGutenbergTextUrl, segmentChapters } from './ingest';

describe('source URLs', () => {
  it('only allows https Gutenberg and Wikisource', () => {
    expect(() => assertAllowedSourceUrl('https://www.gutenberg.org/ebooks/2000')).not.toThrow();
    expect(() => assertAllowedSourceUrl('https://es.wikisource.org/wiki/La_Celestina')).not.toThrow();
    expect(() => assertAllowedSourceUrl('http://www.gutenberg.org/ebooks/2000')).toThrow(/https/);
    expect(() => assertAllowedSourceUrl('https://evil.example.com/gutenberg.org')).toThrow(/Gutenberg o Wikisource/);
    expect(() => assertAllowedSourceUrl('https://gutenberg.org.evil.com/x')).toThrow();
    expect(() => assertAllowedSourceUrl('https://169.254.169.254/latest')).toThrow();
    expect(() => assertAllowedSourceUrl('nope')).toThrow(/inválida/);
  });

  it('maps a Gutenberg ebook page to its plain-text file', () => {
    expect(resolveGutenbergTextUrl(new URL('https://www.gutenberg.org/ebooks/2000')).href)
      .toBe('https://www.gutenberg.org/cache/epub/2000/pg2000.txt');
  });

  it('follows redirects only to allowed hosts', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: '/files/2000/2000-0.txt' } }))
      .mockResolvedValueOnce(new Response('texto', { status: 200 }));
    expect(await fetchSourceText('https://www.gutenberg.org/ebooks/2000', fetchImpl)).toBe('texto');

    const evil = vi.fn().mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/admin' } }));
    await expect(fetchSourceText('https://www.gutenberg.org/ebooks/2000', evil)).rejects.toThrow();
    expect(evil).toHaveBeenCalledTimes(1);
  });
});

describe('cleanSourceText', () => {
  it('removes the Gutenberg licence and wiki markup', () => {
    const raw = [
      'The Project Gutenberg eBook of Don Quijote',
      '*** START OF THE PROJECT GUTENBERG EBOOK DON QUIJOTE ***',
      '',
      'En un lugar de la Mancha[1], de cuyo {{nota}} nombre no quiero acordarme.',
      '',
      '',
      '',
      'Fin.',
      '*** END OF THE PROJECT GUTENBERG EBOOK DON QUIJOTE ***',
      'License text',
    ].join('\r\n');
    const out = cleanSourceText(raw);
    expect(out).toBe('En un lugar de la Mancha, de cuyo  nombre no quiero acordarme.\n\nFin.');
  });
});

describe('segmentChapters', () => {
  it('splits on chapter headings', () => {
    const text = 'Prólogo breve.\n\nCAPÍTULO PRIMERO\nTexto uno.\n\nCAPÍTULO II\nTexto dos.\n\nCapítulo III. Del final\nTexto tres.';
    const chapters = segmentChapters(text);
    expect(chapters.map(c => c.title)).toEqual(['CAPÍTULO PRIMERO', 'CAPÍTULO II', 'Capítulo III. Del final']);
    expect(chapters[0].text).toContain('Prólogo breve.');
    expect(chapters[2].text).toBe('Texto tres.');
  });

  it('splits plays by act and falls back to fixed-size chunks', () => {
    expect(segmentChapters('ACTO PRIMERO\nA\n\nACTO SEGUNDO\nB').map(c => c.title)).toEqual(['ACTO PRIMERO', 'ACTO SEGUNDO']);
    const long = Array.from({ length: 30 }, (_, i) => `Párrafo ${i} ${'x'.repeat(1000)}`).join('\n\n');
    const chunks = segmentChapters(long);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].title).toBe('Parte 1');
    expect(chunks.map(c => c.text).join('\n\n')).toBe(long);
  });
});
