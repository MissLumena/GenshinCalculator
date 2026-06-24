import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(root, 'public');

describe('seo public files', () => {
  it('includes robots.txt and sitemap.xml', () => {
    for (const file of ['robots.txt', 'sitemap.xml']) {
      expect(fs.existsSync(path.join(publicDir, file))).toBe(true);
    }
  });

  it('references sitemap in robots.txt', () => {
    const robots = fs.readFileSync(path.join(publicDir, 'robots.txt'), 'utf8');
    expect(robots).toContain('Sitemap:');
    expect(robots).toContain('/sitemap.xml');
  });

  it('includes main routes in sitemap.xml', () => {
    const sitemap = fs.readFileSync(path.join(publicDir, 'sitemap.xml'), 'utf8');
    expect(sitemap).toContain('<loc>https://genshin-calculator-2ow.pages.dev/</loc>');
    expect(sitemap).toContain('<loc>https://genshin-calculator-2ow.pages.dev/characters</loc>');
    expect(sitemap).toContain('<loc>https://genshin-calculator-2ow.pages.dev/character/venti</loc>');
  });

  it('includes seo tags in index.html', () => {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    expect(html).toContain('name="description"');
    expect(html).toContain('property="og:title"');
    expect(html).toContain('application/ld+json');
    expect(html).toContain('<noscript>');
  });
});
