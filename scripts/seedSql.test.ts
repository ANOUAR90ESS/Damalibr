import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';
import { buildSeedSql } from './seedSql';

describe('supabase/seed.sql', () => {
  it('is up to date with src/data/seedBooks.ts (run `bun run db:seed` to regenerate)', () => {
    const onDisk = readFileSync(new URL('../supabase/seed.sql', import.meta.url), 'utf8');
    expect(onDisk).toBe(buildSeedSql());
  });
});
