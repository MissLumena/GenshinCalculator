/**
 * Генерирует версии фона Windrise для разных экранов.
 * Запуск: npm run optimize:background
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bgDir = path.join(root, 'public/background');

const SOURCE_CANDIDATES = [
  path.join(bgDir, 'windrise-source.jpg'),
  path.join(bgDir, 'windrise-source.png'),
  path.join(bgDir, 'windrise.png'),
  path.join(bgDir, 'windrise.jpg'),
];

const VARIANTS = [
  { name: 'windrise-1280.jpg', width: 1280, quality: 90 },
  { name: 'windrise-1920.jpg', width: 1920, quality: 92 },
  { name: 'windrise-2560.jpg', width: 2560, quality: 93 },
  { name: 'windrise-1920.webp', width: 1920, quality: 88, webp: true },
  { name: 'windrise-2560.webp', width: 2560, quality: 90, webp: true },
];

function findSource() {
  for (const candidate of SOURCE_CANDIDATES) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

async function main() {
  const sourcePath = findSource();
  if (!sourcePath) {
    throw new Error(`Не найден исходник фона в ${bgDir}`);
  }

  const sourceMeta = await sharp(sourcePath).metadata();
  const sourceInfo = {
    path: path.basename(sourcePath),
    width: sourceMeta.width,
    height: sourceMeta.height,
    format: sourceMeta.format,
  };

  console.log('Source:', sourceInfo);

  const generated = [];

  for (const variant of VARIANTS) {
    const pipeline = sharp(sourcePath)
      .rotate()
      .resize({
        width: variant.width,
        fit: 'inside',
        withoutEnlargement: false,
        kernel: sharp.kernel.lanczos3,
      })
      .sharpen({ sigma: variant.width > sourceMeta.width ? 0.55 : 0.3 });

    const outPath = path.join(bgDir, variant.name);
    if (variant.webp) {
      await pipeline.webp({ quality: variant.quality, effort: 6 }).toFile(outPath);
    } else {
      await pipeline.jpeg({ quality: variant.quality, mozjpeg: true }).toFile(outPath);
    }

    const meta = await sharp(outPath).metadata();
    generated.push({
      file: variant.name,
      width: meta.width,
      height: meta.height,
      bytes: fs.statSync(outPath).size,
    });
    console.log(`✓ ${variant.name} → ${meta.width}x${meta.height}`);
  }

  // Обратная совместимость: windrise.png → копия 1920 JPEG
  const legacyPath = path.join(bgDir, 'windrise.png');
  fs.copyFileSync(path.join(bgDir, 'windrise-1920.jpg'), legacyPath);

  const manifest = {
    generatedAt: new Date().toISOString(),
    source: sourceInfo,
    variants: generated,
    recommended: {
      default: 'windrise-1920.webp',
      fallback: 'windrise-1920.jpg',
      retina: 'windrise-2560.webp',
    },
  };

  fs.writeFileSync(
    path.join(bgDir, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
