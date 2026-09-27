// Minimal PCM/WAV helpers. All pipeline audio is 16-bit mono PCM.

export const SAMPLE_RATE = 24_000;

export function pcmToWav(pcm: Buffer, sampleRate = SAMPLE_RATE): Buffer {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // PCM chunk size
  header.writeUInt16LE(1, 20); // PCM format
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28); // byte rate
  header.writeUInt16LE(2, 32); // block align
  header.writeUInt16LE(16, 34); // bits per sample
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

/** Extracts the PCM samples from a 16-bit mono WAV file. */
export function wavToPcm(wav: Buffer): { pcm: Buffer; sampleRate: number } {
  if (wav.toString('ascii', 0, 4) !== 'RIFF' || wav.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('Archivo WAV inválido');
  }
  let offset = 12;
  let sampleRate = SAMPLE_RATE;
  while (offset + 8 <= wav.length) {
    const id = wav.toString('ascii', offset, offset + 4);
    const size = wav.readUInt32LE(offset + 4);
    if (id === 'fmt ') sampleRate = wav.readUInt32LE(offset + 12);
    if (id === 'data') return { pcm: wav.subarray(offset + 8, offset + 8 + size), sampleRate };
    offset += 8 + size + (size % 2);
  }
  throw new Error('WAV sin datos de audio');
}

export const silence = (seconds: number, sampleRate = SAMPLE_RATE) => Buffer.alloc(Math.round(seconds * sampleRate) * 2);

export const pcmSeconds = (pcm: Buffer, sampleRate = SAMPLE_RATE) => pcm.length / 2 / sampleRate;

/** Parses the sample rate from a Gemini audio mime type such as "audio/L16;codec=pcm;rate=24000". */
export function rateFromMime(mime: string | undefined): number {
  const m = mime?.match(/rate=(\d+)/);
  return m ? Number(m[1]) : SAMPLE_RATE;
}
