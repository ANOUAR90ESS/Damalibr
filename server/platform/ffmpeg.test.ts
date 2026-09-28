import { describe, expect, it } from 'vitest';
import { buildRenderArgs } from './ffmpeg';

const scenes = [
  { imagePath: '/tmp/a.png', duration: 5 },
  { imagePath: '/tmp/b.png', duration: 7.5 },
];

describe('render profiles', () => {
  it.each([
    ['16:9', 1920, 1080],
    ['9:16', 1080, 1920],
    ['1:1', 1080, 1080],
  ])('%s uses the requested dimensions', (_name, width, height) => {
    const args = buildRenderArgs({ outputPath: '/tmp/out.mp4', width, height, scenes }, '/tmp/concat.txt');
    expect(args).toContain(`scale=${width}:${height}:force_original_aspect_ratio=decrease`);
    expect(args).toContain(`pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`);
  });

  it('pads short audio and limits output to the scene timeline', () => {
    const args = buildRenderArgs({
      outputPath: '/tmp/out.mp4',
      scenes,
      audioPath: '/tmp/voice.m4a',
    }, '/tmp/concat.txt');

    expect(args).toContain('-af');
    expect(args).toContain('apad');
    expect(args).toContain('-t');
    expect(args).toContain('12.500');
    expect(args).not.toContain('-shortest');
  });

  it('adds subtitles to the video filter chain', () => {
    const args = buildRenderArgs({
      outputPath: '/tmp/out.mp4',
      scenes,
      subtitlePath: '/tmp/subtitles.srt',
    }, '/tmp/concat.txt');

    expect(args.join(' ')).toContain("subtitles='/tmp/subtitles.srt'");
  });
});
