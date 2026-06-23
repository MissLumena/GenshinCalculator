import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(root, 'public');

describe('favicon assets', () => {
  it('includes generated icons in public/', () => {
    for (const file of [
      'favicon.ico',
      'favicon-16x16.png',
      'favicon-32x32.png',
      'apple-touch-icon.png',
      'site.webmanifest',
    ]) {
      expect(fs.existsSync(path.join(publicDir, file))).toBe(true);
    }
  });

  it('links favicon tags in index.html', () => {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

    expect(html).toContain('href="/favicon.ico"');
    expect(html).toContain('href="/favicon-32x32.png"');
    expect(html).toContain('href="/apple-touch-icon.png"');
    expect(html).toContain('href="/site.webmanifest"');
  });
});
