import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { buildSeedSql } from './seedSql';

const target = fileURLToPath(new URL('../supabase/seed.sql', import.meta.url));
writeFileSync(target, buildSeedSql());
console.log(`Seed written to ${target}`);
