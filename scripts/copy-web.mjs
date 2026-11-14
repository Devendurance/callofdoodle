// Copies the static game (served as-is by Vercel from the repo root) into www/,
// the folder Capacitor bundles into the iOS app.
import { cpSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'www');
const files = ['index.html', 'style.css', 'manifest.json', 'three.module.min.js',
  'game.js', 'data.js', 'bots.js', 'world.js', 'fx.js', 'audio.js'];
const dirs = ['fonts'];

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const f of files) {
  if (!existsSync(join(root, f))) throw new Error(`missing ${f}`);
  cpSync(join(root, f), join(out, f));
}
for (const d of dirs) cpSync(join(root, d), join(out, d), { recursive: true });
console.log(`copied ${files.length} files + ${dirs.join(', ')} to www/`);
