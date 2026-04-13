/**
 * PWA İkon Üretici
 * Çalıştır: node scripts/generate-icons.mjs
 * Gereksinim: sharp (npm install sharp --save-dev)
 *
 * public/icons/icon.svg → 192x192, 512x512, 512x512-maskable PNG
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

async function generateIcons() {
  let sharp;
  try {
    sharp = (await import('sharp')).default;
  } catch {
    console.error('❌ sharp paketi bulunamadı. Çalıştırın: npm install sharp --save-dev');
    process.exit(1);
  }

  const svgPath = path.join(rootDir, 'public', 'icons', 'icon.svg');
  const svgBuffer = readFileSync(svgPath);

  const sizes = [
    { name: 'icon-192.png', size: 192 },
    { name: 'icon-512.png', size: 512 },
    { name: 'icon-512-maskable.png', size: 512 },
  ];

  for (const { name, size } of sizes) {
    const outPath = path.join(rootDir, 'public', 'icons', name);
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(outPath);
    console.log(`✅ Generated: public/icons/${name} (${size}x${size})`);
  }

  console.log('\n🎉 Tüm ikonlar oluşturuldu!');
}

generateIcons().catch(console.error);
