// Renders the Call of Doodle app icon and splash screen (notebook paper + doodled crosshair)
// into the iOS asset catalog and the Android res/ folders. Run: npm run icons
import { Resvg } from '@resvg/resvg-js';
import { writeFileSync, existsSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const assets = join(root, 'ios/App/App/Assets.xcassets');
// App Store Connect rejects icons with an alpha channel, so re-encode resvg's RGBA output as plain RGB.
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function rgbPng(rendered) {
  const { width: w, height: h, pixels } = rendered;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4, o = y * (w * 3 + 1) + 1 + x * 3;
    raw[o] = pixels[i]; raw[o + 1] = pixels[i + 1]; raw[o + 2] = pixels[i + 2];
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

const ink = '#1c1c26', paper = '#f7f2e4', red = '#e0473f', rule = '#9ec3e6', margin = '#e88b8b';

function lines(w, h, gap) {
  let s = '';
  for (let y = gap * 1.5; y < h; y += gap) s += `<path d="M0 ${y}H${w}" stroke="${rule}" stroke-width="${gap * 0.06}"/>`;
  return s;
}
function crosshair(cx, cy, r) {
  const sw = r * 0.16;
  return `<g fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path d="M${cx - r} ${cy + r * 0.04} C ${cx - r} ${cy - r * 0.58}, ${cx - r * 0.52} ${cy - r * 1.02}, ${cx + r * 0.04} ${cy - r}
             C ${cx + r * 0.6} ${cy - r * 0.97}, ${cx + r * 1.02} ${cy - r * 0.5}, ${cx + r} ${cy + r * 0.06}
             C ${cx + r * 0.98} ${cy + r * 0.6}, ${cx + r * 0.5} ${cy + r * 1.01}, ${cx - r * 0.06} ${cy + r}
             C ${cx - r * 0.58} ${cy + r * 0.99}, ${cx - r * 1.0} ${cy + r * 0.55}, ${cx - r} ${cy + r * 0.04}Z"
          stroke="${ink}" stroke-width="${sw}"/>
    <path d="M${cx} ${cy - r * 1.35}V${cy - r * 0.42}M${cx} ${cy + r * 0.42}V${cy + r * 1.35}M${cx - r * 1.35} ${cy}H${cx - r * 0.42}M${cx + r * 0.42} ${cy}H${cx + r * 1.35}"
          stroke="${red}" stroke-width="${sw}"/>
    <circle cx="${cx}" cy="${cy}" r="${r * 0.1}" fill="${ink}" stroke="none"/>
  </g>`;
}

// App icon 1024x1024, opaque (App Store rejects alpha)
const S = 1024;
const icon = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
  <rect width="${S}" height="${S}" fill="${paper}"/>
  ${lines(S, S, 92)}
  <path d="M150 0V${S}" stroke="${margin}" stroke-width="7"/>
  ${crosshair(S / 2 + 30, S / 2, 300)}
</svg>`;
writeFileSync(join(assets, 'AppIcon.appiconset/AppIcon-512@2x.png'),
  rgbPng(new Resvg(icon, { background: paper }).render()));

// Splash 2732x2732: paper, crosshair, title in the game's marker font
const W = 2732;
const splash = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${W}" viewBox="0 0 ${W} ${W}">
  <rect width="${W}" height="${W}" fill="${paper}"/>
  ${lines(W, W, 120)}
  ${crosshair(W / 2, W / 2 - 120, 190)}
  <text x="${W / 2}" y="${W / 2 + 290}" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="150" fill="${ink}" letter-spacing="6">CALL OF DOODLE</text>
</svg>`;
const png = rgbPng(new Resvg(splash, { background: paper, font: { loadSystemFonts: true } }).render());
for (const n of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png'])
  writeFileSync(join(assets, 'Splash.imageset', n), png);
console.log('iOS icon + splash written');

// Android: legacy square + round launcher icons, adaptive-icon foreground (crosshair on transparent,
// background colour in values/ic_launcher_background.xml), and landscape/portrait splash screens.
const res = join(root, 'android/app/src/main/res');
if (existsSync(res)) {
  const dens = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
  const iconSvg = (n, round) => `<svg xmlns="http://www.w3.org/2000/svg" width="${n}" height="${n}" viewBox="0 0 ${S} ${S}">
    ${round ? `<clipPath id="c"><circle cx="${S / 2}" cy="${S / 2}" r="${S / 2}"/></clipPath><g clip-path="url(#c)">` : '<g>'}
    <rect width="${S}" height="${S}" fill="${paper}"/>${lines(S, S, 92)}
    <path d="M150 0V${S}" stroke="${margin}" stroke-width="7"/>${crosshair(S / 2 + 30, S / 2, 300)}</g></svg>`;
  // adaptive foreground: 108dp canvas, keep the crosshair inside the 66dp safe zone
  const fgSvg = (n) => `<svg xmlns="http://www.w3.org/2000/svg" width="${n}" height="${n}" viewBox="0 0 108 108">
    ${crosshair(54, 54, 20)}</svg>`;
  const splashSvg = (w, h) => {
    const u = Math.min(w, h);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
      <rect width="${w}" height="${h}" fill="${paper}"/>${lines(w, h, u / 12)}
      ${crosshair(w / 2, h / 2 - u * 0.08, u * 0.13)}
      <text x="${w / 2}" y="${h / 2 + u * 0.2}" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="${u * 0.09}" fill="${ink}" letter-spacing="${u * 0.004}">CALL OF DOODLE</text></svg>`;
  };
  const render = (svg) => new Resvg(svg, { font: { loadSystemFonts: true } }).render().asPng();
  for (const [d, k] of Object.entries(dens)) {
    const n = Math.round(48 * k);
    writeFileSync(join(res, `mipmap-${d}/ic_launcher.png`), render(iconSvg(n, false)));
    writeFileSync(join(res, `mipmap-${d}/ic_launcher_round.png`), render(iconSvg(n, true)));
    writeFileSync(join(res, `mipmap-${d}/ic_launcher_foreground.png`), render(fgSvg(Math.round(108 * k))));
    const lw = Math.round(480 * k), lh = Math.round(320 * k);
    writeFileSync(join(res, `drawable-land-${d}/splash.png`), render(splashSvg(lw, lh)));
    writeFileSync(join(res, `drawable-port-${d}/splash.png`), render(splashSvg(lh, lw)));
  }
  writeFileSync(join(res, 'drawable/splash.png'), render(splashSvg(480, 320)));
  console.log('Android icons + splash written');
}
