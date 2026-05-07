/**
 * Gera todos os PNGs de favicon a partir do SVG do brand kit.
 * Uso: node scripts/generate-favicons.js
 */
const fs   = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT     = path.join(__dirname, '..');
const SRC_SVG  = path.join(ROOT, 'apps/web/public/brand/notafacil-favicon.svg');
const OUT_DIR  = path.join(ROOT, 'apps/web/public');

// Tamanhos do <head> em layout.tsx
const SIZES = [
  { size: 16,  name: 'favicon-16px.png'              },
  { size: 32,  name: 'favicon-32px.png'              },
  { size: 72,  name: 'favicon-72px.png'              },
  { size: 96,  name: 'favicon-96px.png'              },
  { size: 120, name: 'favicon-120px.png'             },
  { size: 152, name: 'favicon-152px.png'             },
  { size: 180, name: 'apple-touch-icon.png'          },
  { size: 192, name: 'android-chrome-192x192.png'    },
  { size: 256, name: 'favicon-256px.png'             },
  { size: 512, name: 'android-chrome-512x512.png'    },
];

(async () => {
  if (!fs.existsSync(SRC_SVG)) {
    console.error('SVG não encontrado:', SRC_SVG);
    process.exit(1);
  }
  const svg = fs.readFileSync(SRC_SVG);

  for (const { size, name } of SIZES) {
    const out = path.join(OUT_DIR, name);
    await sharp(svg, { density: 384 })
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9 })
      .toFile(out);
    console.log(`✓ ${name} (${size}x${size})`);
  }

  // favicon.ico — usa o 32x32 como base (multi-resolução opcional)
  const icoBuffer = await sharp(svg, { density: 384 })
    .resize(32, 32, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(OUT_DIR, 'favicon.ico'), icoBuffer);
  console.log('✓ favicon.ico');

  console.log('\nDone.');
})().catch((e) => { console.error(e); process.exit(1); });
