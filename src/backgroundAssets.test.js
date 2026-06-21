import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bgDir = path.join(root, 'public/background');

describe('background assets', () => {
  it('includes optimized variants and manifest', () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(bgDir, 'manifest.json'), 'utf8'),
    );

    expect(manifest.source.width).toBeGreaterThanOrEqual(1024);
    expect(manifest.variants.some((item) => item.file === 'windrise-1920.jpg')).toBe(true);
    expect(manifest.variants.some((item) => item.file === 'windrise-2560.webp')).toBe(true);

    for (const file of ['windrise-1920.jpg', 'windrise-2560.webp', 'windrise-source.jpg']) {
      expect(fs.existsSync(path.join(bgDir, file))).toBe(true);
    }

    const hd = manifest.variants.find((item) => item.file === 'windrise-1920.jpg');
    expect(hd.width).toBeGreaterThanOrEqual(1920);
    expect(hd.height).toBeGreaterThanOrEqual(1080);
  });

  it('routes /api through Pages Functions only', () => {
    const routes = JSON.parse(
      fs.readFileSync(path.join(root, 'public/_routes.json'), 'utf8'),
    );
    expect(routes.include).toContain('/api/*');
    expect(fs.existsSync(path.join(root, 'functions/api/[[path]].js'))).toBe(true);
  });

  it('applies evening dim and sky-only sunset without blur', () => {
    const css = fs.readFileSync(path.join(root, 'src/index.css'), 'utf8');
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

    expect(html).toContain('id="evening-dim"');
    expect(html).toContain('id="sunset-scene"');
    expect(html).toContain("href=\"/background/windrise-1920.webp\"");
    expect(html).toContain("background-image: url('/background/windrise-1920.webp')");
    expect(html).not.toContain('rel="preload" as="image" href="/background/windrise-1920.jpg"');
    expect(css).toContain('#evening-dim');
    expect(css).toContain('#sunset-scene::before');
    expect(css).toContain('mix-blend-mode: soft-light');
    expect(css).toContain('--sunset-sky-height');
    expect(css).not.toMatch(/body\s*\{[^}]*filter:/s);
    expect(css).not.toMatch(/background-image:[^;]*blur/s);
  });
});
