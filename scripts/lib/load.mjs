import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import YAML from 'yaml';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const read = f => YAML.parse(readFileSync(join(ROOT, 'data', f), 'utf8'));

export function loadAll() {
  const config = read('config.yaml');
  const taxonomy = read('taxonomy.yaml');
  const raw = read('opportunities.yaml');
  const opportunities = (raw.opportunities || []).map(op => ({
    ...op,
    // YAML turns 2026-12-01 into a Date; keep plain strings throughout.
    last_verified: str(op.last_verified),
    deadlines: (op.deadlines || []).map(d => ({ ...d, date: str(d.date), time: d.time != null ? String(d.time) : undefined })),
  }));
  return { config, taxonomy, opportunities };
}

function str(v) {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return v == null ? v : String(v);
}
