import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('cloudflare deploy config', () => {
  it('wrangler.jsonc includes API_ORIGIN and build script', () => {
    const raw = readFileSync(join(process.cwd(), 'wrangler.jsonc'), 'utf8');
    expect(raw).toContain('API_ORIGIN');
    expect(raw).toContain('genshincalculator-l6rw.onrender.com');
    expect(raw).toContain('scripts/cloudflare-build.mjs');
  });

  it('cloudflare-env-paste has Supabase vars for build', () => {
    const raw = readFileSync(join(process.cwd(), 'deploy', 'cloudflare-env-paste.txt'), 'utf8');
    expect(raw).toMatch(/SUPABASE_URL=https:\/\/.+\.supabase\.co/);
    expect(raw).toContain('SUPABASE_ANON_KEY=');
  });
});
