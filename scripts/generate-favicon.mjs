/**
 * Генерирует favicon и apple-touch-icon из исходника в public/.
 * Запуск: npm run generate:favicon
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(root, 'public');

const SOURCE_CANDIDATES = [
  path.join(publicDir, 'favicon-source.jpg'),
  path.join(publicDir, 'background', 'favicon.ico.jpg'),
  path.join(publicDir, 'background', 'favicon-source.jpg'),
];

const OUTPUTS = [
  { name: 'favicon-16x16.png', size: 16 },
  { name: 'favicon-32x32.png', size: 32 },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
];

function findSource() {
  for (const candidate of SOURCE_CANDIDATES) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function squareFaceCrop(meta) {
  const cropSize = Math.min(meta.width, meta.height);
  const left = Math.max(0, Math.floor((meta.width - cropSize) / 2));
  const top = 0;
  return { left, top, width: cropSize, height: cropSize };
}

async function buildSquarePipeline(sourcePath) {
  const meta = await sharp(sourcePath).metadata();
  if (!meta.width || !meta.height) {
    throw new Error('Не удалось прочитать размеры исходника favicon');
  }

  const crop = squareFaceCrop(meta);
  return sharp(sourcePath).rotate().extract(crop);
}

async function main() {
  const sourcePath = findSource();
  if (!sourcePath) {
    throw new Error(
      `Не найден исходник favicon. Положите файл в ${path.join(publicDir, 'favicon-source.jpg')}`,
    );
  }

  const pipeline = await buildSquarePipeline(sourcePath);
  const generated = [];

  for (const output of OUTPUTS) {
    const target = path.join(publicDir, output.name);
    await pipeline
      .clone()
      .resize(output.size, output.size, {
        fit: 'cover',
        kernel: sharp.kernel.lanczos3,
      })
      .png({ compressionLevel: 9 })
      .toFile(target);

    generated.push({
      file: output.name,
      size: output.size,
      bytes: fs.statSync(target).size,
    });
  }

  const icoPath = path.join(publicDir, 'favicon.ico');
  const { default: pngToIco } = await import('png-to-ico');
  const icoBuffers = await Promise.all(
    [16, 32, 48].map(async (size) => {
      return pipeline
        .clone()
        .resize(size, size, { fit: 'cover', kernel: sharp.kernel.lanczos3 })
        .png()
        .toBuffer();
    }),
  );
  fs.writeFileSync(icoPath, await pngToIco(icoBuffers));

  const manifest = {
    name: 'Genshin Calculator',
    short_name: 'Genshin Calc',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    theme_color: '#4a6280',
    background_color: '#4a6280',
    display: 'standalone',
  };

  fs.writeFileSync(
    path.join(publicDir, 'site.webmanifest'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );

  console.log('Favicon source:', path.relative(root, sourcePath));
  for (const item of generated) {
    console.log(`  ${item.file} (${item.size}px, ${item.bytes} bytes)`);
  }
  console.log(`  favicon.ico (${fs.statSync(icoPath).size} bytes)`);
  console.log('  site.webmanifest');
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
