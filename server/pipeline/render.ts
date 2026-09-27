import { spawn } from 'child_process';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';
import type { Episode, ScriptScene } from '../../src/types';
import type { MediaStore } from './media';
import { pcmToWav, SAMPLE_RATE, silence, wavToPcm } from './audio';
import { LINE_GAP_SECONDS } from './voices';

const FPS = 25;
export const ffmpegPath = () => process.env.FFMPEG_PATH || 'ffmpeg';

function run(bin: string, args: string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { cwd });
    let stderr = '';
    child.stderr.on('data', d => { stderr = (stderr + d).slice(-2000); });
    child.on('error', e => reject(new Error(`No se pudo ejecutar FFmpeg (${bin}): ${e.message}`)));
    child.on('close', code => (code === 0 ? resolve() : reject(new Error(`FFmpeg falló (código ${code}): ${stderr.trim()}`))));
  });
}

export async function isFfmpegAvailable(bin = ffmpegPath()): Promise<boolean> {
  try {
    await run(bin, ['-version'], os.tmpdir());
    return true;
  } catch {
    return false;
  }
}

const assTime = (s: number) => {
  const cs = Math.round(s * 100);
  const h = Math.floor(cs / 360000);
  const m = Math.floor((cs % 360000) / 6000);
  const sec = Math.floor((cs % 6000) / 100);
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(cs % 100).padStart(2, '0')}`;
};

const assText = (t: string) => t.replace(/[{}]/g, '').replace(/\\/g, '/').replace(/\r?\n/g, '\\N');

export interface SubtitleCue { start: number; end: number; speaker: string; text: string }

export function buildAss(cues: SubtitleCue[], width: number, height: number): string {
  const fontSize = Math.round(height * 0.034);
  const margin = Math.round(width * 0.06);
  const marginV = Math.round(height * (width < height ? 0.14 : 0.08));
  return [
    '[Script Info]',
    'ScriptType: v4.00+',
    `PlayResX: ${width}`,
    `PlayResY: ${height}`,
    'WrapStyle: 0',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    `Style: Default,DejaVu Sans,${fontSize},&H00FFFFFF,&H000000FF,&H00000000,&H96000000,0,0,0,0,100,100,0,0,1,3,1,2,${margin},${margin},${marginV},1`,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
    // Speaker name in amber and bold, then the line.
    ...cues.map(c => `Dialogue: 0,${assTime(c.start)},${assTime(c.end)},Default,,0,0,0,,{\\c&H24BFFB&\\b1}${assText(c.speaker)}{\\r}\\N${assText(c.text)}`),
    '',
  ].join('\n');
}

/** Builds the scene soundtrack (lines + pauses) and the subtitle cues, relative to `offset`. */
export async function sceneAudio(media: MediaStore, scene: ScriptScene, offset: number): Promise<{ pcm: Buffer; cues: SubtitleCue[]; duration: number }> {
  const parts: Buffer[] = [];
  const cues: SubtitleCue[] = [];
  let t = 0;
  for (const line of scene.lines) {
    let pcm: Buffer;
    if (line.audio_path) {
      const decoded = wavToPcm(await media.read(line.audio_path));
      if (decoded.sampleRate !== SAMPLE_RATE) throw new Error(`Audio con frecuencia inesperada (${decoded.sampleRate} Hz) en ${line.id}`);
      pcm = decoded.pcm;
    } else {
      pcm = silence(line.duration_seconds); // simulated voices: silent track, timed subtitles
    }
    const seconds = pcm.length / 2 / SAMPLE_RATE;
    cues.push({ start: offset + t, end: offset + t + seconds, speaker: line.character_name, text: line.text });
    parts.push(pcm, silence(LINE_GAP_SECONDS));
    t += seconds + LINE_GAP_SECONDS;
  }
  const duration = Math.max(3, t);
  if (duration > t) parts.push(silence(duration - t));
  return { pcm: Buffer.concat(parts), cues, duration };
}

export interface RenderedEpisode {
  video_url: string;
  hls_url: string;
  thumbnail_url: string;
  duration: number;
}

/** Renders one episode to MP4 + HLS (Ken Burns over each scene image, burned-in subtitles). */
export async function renderEpisode(media: MediaStore, bookId: string, episode: Episode, bin = ffmpegPath()): Promise<RenderedEpisode> {
  const [width, height] = episode.format === 'film' ? [1280, 720] : [720, 1280];
  const dir = await mkdtemp(path.join(os.tmpdir(), 'lamina-render-'));
  try {
    const cues: SubtitleCue[] = [];
    const clips: string[] = [];
    let offset = 0;

    for (const [i, scene] of episode.script_json.scenes.entries()) {
      const audio = await sceneAudio(media, scene, offset);
      cues.push(...audio.cues);
      await writeFile(path.join(dir, `scene_${i}.wav`), pcmToWav(audio.pcm));
      const frames = Math.ceil(audio.duration * FPS);
      const clip = `scene_${i}.mp4`;

      const video = scene.image_path
        ? (await writeFile(path.join(dir, `scene_${i}.img`), await media.read(scene.image_path)), ['-i', `scene_${i}.img`])
        : ['-f', 'lavfi', '-i', `color=c=0x14121f:s=${width}x${height}:r=${FPS}:d=${audio.duration.toFixed(2)}`];
      const filter = scene.image_path
        ? `[0:v]scale=${width * 2}:${height * 2}:force_original_aspect_ratio=increase,crop=${width * 2}:${height * 2},` +
          `zoompan=z='min(zoom+0.0007,1.2)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${width}x${height}:fps=${FPS},format=yuv420p[v]`
        : '[0:v]format=yuv420p[v]';

      await run(bin, [
        ...video, '-i', `scene_${i}.wav`,
        '-filter_complex', filter, '-map', '[v]', '-map', '1:a',
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-r', String(FPS),
        '-c:a', 'aac', '-b:a', '128k', '-ar', '48000',
        '-t', audio.duration.toFixed(2), clip,
      ], dir);
      clips.push(clip);
      offset += audio.duration;
    }

    await writeFile(path.join(dir, 'subs.ass'), buildAss(cues, width, height));
    await writeFile(path.join(dir, 'clips.txt'), clips.map(c => `file '${c}'`).join('\n'));
    await run(bin, [
      '-f', 'concat', '-safe', '0', '-i', 'clips.txt',
      '-vf', 'subtitles=subs.ass',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-g', String(FPS * 2), '-keyint_min', String(FPS * 2), '-sc_threshold', '0',
      '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', 'episode.mp4',
    ], dir);
    await run(bin, ['-i', 'episode.mp4', '-c', 'copy', '-f', 'hls', '-hls_time', '4', '-hls_playlist_type', 'vod', '-hls_segment_filename', 'seg_%03d.ts', 'index.m3u8'], dir);
    await run(bin, ['-ss', '1', '-i', 'episode.mp4', '-frames:v', '1', '-q:v', '3', 'thumb.jpg'], dir);

    const prefix = `books/${bookId}/video/${episode.id}`;
    const video_url = await media.put(`${prefix}/episode.mp4`, await readFile(path.join(dir, 'episode.mp4')), 'video/mp4');
    const thumbnail_url = await media.put(`${prefix}/thumb.jpg`, await readFile(path.join(dir, 'thumb.jpg')), 'image/jpeg');
    for (const seg of (await readdir(dir)).filter(f => f.endsWith('.ts')).sort()) {
      await media.put(`${prefix}/${seg}`, await readFile(path.join(dir, seg)), 'video/mp2t');
    }
    const hls_url = await media.put(`${prefix}/index.m3u8`, await readFile(path.join(dir, 'index.m3u8')), 'application/vnd.apple.mpegurl');

    return { video_url, hls_url, thumbnail_url, duration: Math.round(offset) };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
