/**
 * Генерирует robots.txt и sitemap.xml перед production-сборкой.
 * Запуск: node scripts/generate-seo.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(root, 'public');
const charactersFile = path.join(root, 'src', 'characters.js');

const DEFAULT_SITE_URL = 'https://genshin-calculator-2ow.pages.dev';

function loadSiteUrl() {
  if (process.env.VITE_SITE_URL?.trim()) {
    return process.env.VITE_SITE_URL.trim().replace(/\/$/, '');
  }

  for (const envFile of [
    path.join(root, 'deploy', 'cloudflare-build.env'),
    path.join(root, 'deploy', 'cloudflare-env-paste.txt'),
  ]) {
    try {
      for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        if (trimmed.startsWith('VITE_SITE_URL=')) {
          return trimmed.slice('VITE_SITE_URL='.length).trim().replace(/\/$/, '');
        }
        if (trimmed.startsWith('# Сайт:')) {
          const match = trimmed.match(/https?:\/\/\S+/);
          if (match) return match[0].replace(/\/$/, '');
        }
      }
    } catch {
      // optional env file
    }
  }

  return DEFAULT_SITE_URL;
}

function loadCharacterIds() {
  const source = fs.readFileSync(charactersFile, 'utf8');
  const ids = [];
  const pattern = /^\s+\['([^']+)'/gm;
  let match = pattern.exec(source);
  while (match) {
    ids.push(match[1]);
    match = pattern.exec(source);
  }
  return [...new Set(ids)];
}

function buildSitemap(siteUrl, paths) {
  const today = new Date().toISOString().slice(0, 10);
  const urls = paths
    .map((entry) => {
      const loc = `${siteUrl}${entry.path}`;
      const priority = entry.priority ?? '0.7';
      const changefreq = entry.changefreq ?? 'weekly';
      return [
        '  <url>',
        `    <loc>${loc}</loc>`,
        `    <lastmod>${today}</lastmod>`,
        `    <changefreq>${changefreq}</changefreq>`,
        `    <priority>${priority}</priority>`,
        '  </url>',
      ].join('\n');
    })
    .join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urls,
    '</urlset>',
    '',
  ].join('\n');
}

function main() {
  const siteUrl = loadSiteUrl();
  const characterIds = loadCharacterIds();

  const paths = [
    { path: '/', priority: '1.0', changefreq: 'daily' },
    { path: '/characters', priority: '0.9', changefreq: 'weekly' },
    { path: '/team', priority: '0.9', changefreq: 'weekly' },
    { path: '/results', priority: '0.8', changefreq: 'daily' },
    ...characterIds.map((id) => ({
      path: `/character/${id}`,
      priority: '0.7',
      changefreq: 'weekly',
    })),
  ];

  const robots = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /auth/',
    'Disallow: /api/',
    '',
    `Sitemap: ${siteUrl}/sitemap.xml`,
    '',
  ].join('\n');

  fs.writeFileSync(path.join(publicDir, 'robots.txt'), robots, 'utf8');
  fs.writeFileSync(path.join(publicDir, 'sitemap.xml'), buildSitemap(siteUrl, paths), 'utf8');

  console.log(`[generate-seo] site: ${siteUrl}`);
  console.log(`[generate-seo] urls: ${paths.length}`);
  console.log('[generate-seo] wrote public/robots.txt and public/sitemap.xml');
}

main();
