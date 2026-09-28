import { spawn } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';

export interface RenderScene {
  imagePath: string;
  duration: number;
  audioPath?: string;
}

export interface RenderOptions {
  outputPath: string;
  width?: number;
  height?: number;
  fps?: number;
  scenes: RenderScene[];
  audioPath?: string;
  subtitlePath?: string;
  onProgress?: (progress: number) => Promise<void> | void;
}

function ffmpegPath() {
  return process.env.FFMPEG_PATH || 'ffmpeg';
}

export function buildRenderArgs(options: RenderOptions, concatFile: string): string[] {
  const width = options.width || 1920;
  const height = options.height || 1080;
  const fps = options.fps || 30;
  const videoFilters = [
    `scale=${width}:${height}:force_original_aspect_ratio=decrease`,
    `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`,
    'format=yuv420p',
    ...(options.subtitlePath ? [`subtitles='${options.subtitlePath.replace(/'/g, "'\\''")}'`] : []),
  ].join(',');
  const totalDuration = options.scenes.reduce((sum, scene) => sum + Math.max(0.1, scene.duration), 0);
  return [
    '-y', '-f', 'concat', '-safe', '0', '-i', concatFile,
    ...(options.audioPath ? ['-i', options.audioPath] : []),
    '-vf', videoFilters,
    '-r', String(fps), '-c:v', 'libx264', '-preset', process.env.FFMPEG_PRESET || 'veryfast',
    '-movflags', '+faststart',
    ...(options.audioPath ? ['-af', 'apad', '-c:a', 'aac', '-b:a', '192k', '-t', totalDuration.toFixed(3)] : ['-an']),
    options.outputPath,
  ];
}

export async function renderVideo(options: RenderOptions): Promise<void> {
  if (!options.scenes.length) throw new Error('No hay escenas para renderizar.');

  const workDir = path.join(path.dirname(options.outputPath), '.render-' + Date.now());
  await mkdir(workDir, { recursive: true });

  try {
    const concatFile = path.join(workDir, 'concat.txt');
    const lines = options.scenes.map(scene => {
      const image = scene.imagePath.replace(/'/g, "'\\''");
      return `file '${image}'\nduration ${Math.max(0.1, scene.duration)}`;
    });
    lines.push(`file '${options.scenes[options.scenes.length - 1].imagePath.replace(/'/g, "'\\''")}'`);
    await (await import('node:fs/promises')).writeFile(concatFile, lines.join('\n') + '\n');

    await new Promise<void>((resolve, reject) => {
      const args = buildRenderArgs(options, concatFile);
      const child = spawn(ffmpegPath(), args, { stdio: ['ignore', 'ignore', 'pipe'] });
      let stderr = '';
      child.stderr.on('data', chunk => {
        stderr += chunk.toString();
        if (stderr.length > 12000) stderr = stderr.slice(-12000);
        void options.onProgress?.(Math.min(95, 20 + Math.floor(stderr.length / 500)));
      });
      child.once('error', reject);
      child.once('close', code => code === 0 ? resolve() : reject(new Error(`FFmpeg terminó con código ${code}: ${stderr.slice(-2000)}`)));
    });
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}


export async function generateThumbnail(inputPath: string, outputPath: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const args = [
      '-y', '-ss', '1', '-i', inputPath,
      '-frames:v', '1', '-q:v', '2', outputPath,
    ];
    const child = spawn(ffmpegPath(), args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', chunk => {
      stderr += chunk.toString();
      if (stderr.length > 4000) stderr = stderr.slice(-4000);
    });
    child.once('error', reject);
    child.once('close', code => code === 0
      ? resolve()
      : reject(new Error(`FFmpeg thumbnail terminó con código ${code}: ${stderr.slice(-1200)}`)));
  });
}
