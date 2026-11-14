// Profiles, XP / levels, unlocks, settings and doodle avatars.
const KEY = 'doodlestrike.v1';

export const DEFAULT_SETTINGS = {
  sens: 1, assist: true, sfx: true, vib: true, bots: 7, diff: 'normal',
  quality: 'auto', full: true, fps: false,
};

export const AVATARS = [
  { name: 'Smiley', lv: 1 }, { name: 'Kitty', lv: 1 }, { name: 'Robo', lv: 1 },
  { name: 'Bear', lv: 3 }, { name: 'Alien', lv: 5 }, { name: 'Ninja', lv: 7 },
  { name: 'Pirate', lv: 10 }, { name: 'Skull', lv: 13 }, { name: 'Cyclops', lv: 16 },
  { name: 'King', lv: 20 },
];
export const INKS = [
  { name: 'Pencil', c: '#2a2a35', lv: 1 }, { name: 'Ballpoint', c: '#2f5fd0', lv: 1 },
  { name: 'Red pen', c: '#d8352c', lv: 2 }, { name: 'Highlighter', c: '#2fa858', lv: 4 },
  { name: 'Grape', c: '#8a3fc8', lv: 6 }, { name: 'Tangerine', c: '#f07a1a', lv: 8 },
  { name: 'Bubblegum', c: '#e85aa8', lv: 12 }, { name: 'Gold leaf', c: '#d4a017', lv: 18 },
];
export const TITLES = [
  [1, 'Blank Page'], [3, 'Doodler'], [5, 'Scribbler'], [8, 'Sketch Artist'],
  [12, 'Ink Slinger'], [16, 'Margin Menace'], [20, 'Notebook Legend'], [30, 'Grand Illustrator'],
];
export const MAX_LEVEL = 50;

export function xpNeed(l) { return 400 + 200 * (l - 1); }
export function levelInfo(xp) {
  let l = 1, rest = xp;
  while (l < MAX_LEVEL && rest >= xpNeed(l)) { rest -= xpNeed(l); l++; }
  return { level: l, into: rest, need: xpNeed(l), max: l >= MAX_LEVEL };
}
export function titleFor(level) {
  let t = TITLES[0][1];
  for (const [lv, name] of TITLES) if (level >= lv) t = name;
  return t;
}
export function unlocksBetween(a, b) {
  const out = [];
  for (const av of AVATARS) if (av.lv > a && av.lv <= b) out.push(`Face: ${av.name}`);
  for (const ink of INKS) if (ink.lv > a && ink.lv <= b) out.push(`Ink: ${ink.name}`);
  for (const [lv, name] of TITLES) if (lv > a && lv <= b) out.push(`Title: ${name}`);
  return out;
}

function blankStats() {
  return { matches: 0, wins: 0, top3: 0, kills: 0, deaths: 0, headshots: 0, shots: 0, hits: 0, bestStreak: 0, timePlayed: 0, points: 0 };
}
export function newProfile(name, avatar = 0, ink = 0) {
  return { id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name, avatar, ink, xp: 0, created: Date.now(), stats: blankStats() };
}

export const store = {
  data: null,
  load() {
    try { this.data = JSON.parse(localStorage.getItem(KEY)); } catch { this.data = null; }
    if (!this.data || !Array.isArray(this.data.profiles)) this.data = { profiles: [], activeId: null, settings: {} };
    this.data.settings = { ...DEFAULT_SETTINGS, ...this.data.settings };
    for (const p of this.data.profiles) p.stats = { ...blankStats(), ...p.stats };
    return this.data;
  },
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* private mode */ } },
  reset() { try { localStorage.removeItem(KEY); } catch {} this.load(); },
  get settings() { return this.data.settings; },
  get active() { return this.data.profiles.find(p => p.id === this.data.activeId) || this.data.profiles[0] || null; },
};

// ---------------------------------------------------------------- avatars
function rng(seed) { let s = seed * 9301 + 49297; return () => ((s = (s * 9301 + 49297) % 233280) / 233280); }
function wobblyCircle(ctx, cx, cy, r, seed, fill) {
  const R = rng(seed + 7);
  ctx.beginPath();
  const n = 28;
  for (let i = 0; i <= n + 2; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = r * (1 + (R() - 0.5) * 0.05);
    const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  ctx.stroke();
}
function dot(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }

// Draws avatar `id` into ctx at (0,0,size,size). `ink` is the accent colour.
export function drawAvatar(ctx, id, size, ink = '#2a2a35', bg = '#f7f2e4') {
  ctx.save();
  ctx.scale(size / 100, size / 100);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = '#1c1c26'; ctx.fillStyle = '#1c1c26'; ctx.lineWidth = 4;
  const P = '#fbf8ef';
  const head = (r = 34, cy = 54) => wobblyCircle(ctx, 50, cy, r, id, P);
  switch (id) {
    case 1: { // kitty
      ctx.fillStyle = P;
      ctx.beginPath(); ctx.moveTo(20, 40); ctx.lineTo(24, 10); ctx.lineTo(44, 25); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(80, 40); ctx.lineTo(76, 10); ctx.lineTo(56, 25); ctx.closePath(); ctx.fill(); ctx.stroke();
      head();
      ctx.fillStyle = '#1c1c26';
      ctx.beginPath(); ctx.ellipse(38, 49, 3.5, 6, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(62, 49, 3.5, 6, 0, 0, 7); ctx.fill();
      ctx.fillStyle = ink; ctx.beginPath(); ctx.moveTo(46, 59); ctx.lineTo(54, 59); ctx.lineTo(50, 64); ctx.closePath(); ctx.fill();
      ctx.lineWidth = 2.5; ctx.beginPath();
      ctx.moveTo(42, 70); ctx.quadraticCurveTo(46, 74, 50, 68); ctx.quadraticCurveTo(54, 74, 58, 70);
      ctx.moveTo(30, 61); ctx.lineTo(14, 58); ctx.moveTo(30, 66); ctx.lineTo(15, 68);
      ctx.moveTo(70, 61); ctx.lineTo(86, 58); ctx.moveTo(70, 66); ctx.lineTo(85, 68); ctx.stroke();
      break;
    }
    case 2: { // robo
      ctx.beginPath(); ctx.moveTo(50, 22); ctx.lineTo(50, 10); ctx.stroke();
      ctx.fillStyle = ink; dot(ctx, 50, 8, 5);
      ctx.fillStyle = P; ctx.beginPath(); ctx.rect(20, 22, 60, 60); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.rect(14, 44, 6, 16); ctx.rect(80, 44, 6, 16); ctx.stroke();
      ctx.fillStyle = '#1c1c26'; ctx.fillRect(31, 40, 12, 10); ctx.fillRect(57, 40, 12, 10);
      ctx.fillStyle = '#fff'; ctx.fillRect(34, 42, 4, 4); ctx.fillRect(60, 42, 4, 4);
      ctx.lineWidth = 3; ctx.beginPath(); ctx.rect(32, 62, 36, 10);
      for (let x = 38; x < 68; x += 6) { ctx.moveTo(x, 62); ctx.lineTo(x, 72); }
      ctx.stroke();
      break;
    }
    case 3: { // bear
      ctx.fillStyle = P; wobblyCircle(ctx, 24, 26, 12, 3, P); wobblyCircle(ctx, 76, 26, 12, 4, P);
      ctx.fillStyle = ink; dot(ctx, 24, 26, 5); dot(ctx, 76, 26, 5);
      head();
      ctx.fillStyle = '#1c1c26'; dot(ctx, 38, 48, 4); dot(ctx, 62, 48, 4);
      ctx.fillStyle = P; ctx.beginPath(); ctx.ellipse(50, 66, 15, 11, 0, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#1c1c26'; ctx.beginPath(); ctx.ellipse(50, 61, 5, 3.5, 0, 0, 7); ctx.fill();
      ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(50, 64); ctx.lineTo(50, 70); ctx.moveTo(44, 72); ctx.quadraticCurveTo(50, 76, 56, 72); ctx.stroke();
      break;
    }
    case 4: { // alien
      ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(38, 24); ctx.lineTo(30, 6); ctx.moveTo(62, 24); ctx.lineTo(70, 6); ctx.stroke();
      ctx.fillStyle = ink; dot(ctx, 30, 6, 4); dot(ctx, 70, 6, 4);
      ctx.lineWidth = 4; ctx.fillStyle = P; ctx.beginPath(); ctx.ellipse(50, 52, 32, 38, 0, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#1c1c26';
      ctx.beginPath(); ctx.ellipse(37, 50, 9, 14, 0.6, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(63, 50, 9, 14, -0.6, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff'; dot(ctx, 34, 46, 2.5); dot(ctx, 60, 46, 2.5);
      ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(45, 76); ctx.lineTo(55, 76); ctx.stroke();
      break;
    }
    case 5: { // ninja
      head();
      ctx.fillStyle = '#1c1c26'; ctx.beginPath(); ctx.ellipse(50, 54, 34, 34, 0, Math.PI * 0.08, Math.PI * 0.92); ctx.fill();
      ctx.fillStyle = ink; ctx.fillRect(16, 28, 68, 9);
      ctx.beginPath(); ctx.moveTo(82, 32); ctx.lineTo(96, 24); ctx.lineTo(94, 36); ctx.closePath(); ctx.fill();
      ctx.fillStyle = P; ctx.beginPath(); ctx.rect(22, 42, 56, 12); ctx.fill();
      ctx.fillStyle = '#1c1c26'; ctx.beginPath(); ctx.moveTo(30, 46); ctx.lineTo(44, 50); ctx.lineTo(30, 51); ctx.fill();
      ctx.beginPath(); ctx.moveTo(70, 46); ctx.lineTo(56, 50); ctx.lineTo(70, 51); ctx.fill();
      ctx.beginPath(); ctx.arc(50, 54, 34, 0, 7); ctx.stroke();
      break;
    }
    case 6: { // pirate
      head();
      ctx.fillStyle = ink; ctx.beginPath(); ctx.moveTo(16, 44); ctx.quadraticCurveTo(50, 6, 84, 44); ctx.lineTo(84, 40); ctx.quadraticCurveTo(50, 18, 16, 40); ctx.fill();
      ctx.beginPath(); ctx.arc(50, 54, 34, Math.PI * 1.08, Math.PI * 1.92); ctx.lineTo(50, 30); ctx.fill(); ctx.stroke();
      ctx.fillStyle = P; dot(ctx, 40, 29, 2.5); dot(ctx, 56, 26, 2.5); dot(ctx, 66, 33, 2.5);
      ctx.fillStyle = '#1c1c26'; ctx.beginPath(); ctx.ellipse(37, 52, 9, 7, 0, 0, 7); ctx.fill();
      ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(18, 42); ctx.lineTo(70, 58); ctx.stroke();
      dot(ctx, 63, 50, 4);
      ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(36, 70); ctx.quadraticCurveTo(50, 80, 64, 68); ctx.stroke();
      break;
    }
    case 7: { // skull
      head(34, 50);
      ctx.fillStyle = P; ctx.fillRect(34, 72, 32, 14); ctx.strokeRect(34, 72, 32, 14);
      ctx.lineWidth = 2.5; ctx.beginPath(); for (let x = 42; x < 66; x += 8) { ctx.moveTo(x, 74); ctx.lineTo(x, 86); } ctx.stroke();
      ctx.fillStyle = '#1c1c26'; dot(ctx, 37, 48, 9); dot(ctx, 63, 48, 9);
      ctx.fillStyle = ink; dot(ctx, 37, 48, 3); dot(ctx, 63, 48, 3);
      ctx.fillStyle = '#1c1c26'; ctx.beginPath(); ctx.moveTo(50, 58); ctx.lineTo(45, 66); ctx.lineTo(55, 66); ctx.closePath(); ctx.fill();
      break;
    }
    case 8: { // cyclops
      ctx.fillStyle = P; ctx.beginPath(); ctx.moveTo(44, 22); ctx.lineTo(50, 6); ctx.lineTo(56, 22); ctx.closePath(); ctx.fill(); ctx.stroke();
      head();
      ctx.fillStyle = '#fff'; wobblyCircle(ctx, 50, 46, 15, 9, '#fff');
      ctx.fillStyle = ink; dot(ctx, 52, 47, 7); ctx.fillStyle = '#1c1c26'; dot(ctx, 52, 47, 3.5);
      ctx.fillStyle = P; ctx.beginPath(); ctx.moveTo(32, 70); ctx.quadraticCurveTo(50, 84, 68, 70); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(40, 72); ctx.lineTo(44, 78); ctx.lineTo(47, 73); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(53, 73); ctx.lineTo(56, 78); ctx.lineTo(60, 72); ctx.closePath(); ctx.fill(); ctx.stroke();
      break;
    }
    case 9: { // king
      head(32, 58);
      ctx.fillStyle = '#f2b632'; ctx.beginPath();
      ctx.moveTo(24, 34); ctx.lineTo(22, 10); ctx.lineTo(36, 22); ctx.lineTo(50, 6); ctx.lineTo(64, 22); ctx.lineTo(78, 10); ctx.lineTo(76, 34); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = ink; dot(ctx, 50, 24, 4); dot(ctx, 34, 28, 3); dot(ctx, 66, 28, 3);
      ctx.fillStyle = '#1c1c26'; dot(ctx, 39, 54, 4); dot(ctx, 61, 54, 4);
      ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(30, 66); ctx.quadraticCurveTo(40, 60, 50, 66); ctx.quadraticCurveTo(60, 60, 70, 66); ctx.stroke();
      ctx.beginPath(); ctx.arc(50, 72, 7, 0.1, Math.PI - 0.1); ctx.stroke();
      break;
    }
    default: { // smiley
      head();
      ctx.fillStyle = '#1c1c26'; dot(ctx, 38, 46, 4.5); dot(ctx, 62, 46, 4.5);
      ctx.fillStyle = ink; ctx.globalAlpha = 0.45; dot(ctx, 28, 60, 6); dot(ctx, 72, 60, 6); ctx.globalAlpha = 1;
      ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(50, 56, 17, 0.18 * Math.PI, 0.82 * Math.PI); ctx.stroke();
    }
  }
  ctx.restore();
}

const avatarCache = new Map();
export function avatarCanvas(id, ink, size = 128) {
  const key = id + '|' + ink + '|' + size;
  if (avatarCache.has(key)) return avatarCache.get(key);
  const c = document.createElement('canvas'); c.width = c.height = size;
  drawAvatar(c.getContext('2d'), id, size, ink);
  avatarCache.set(key, c);
  return c;
}
// paints a cached avatar onto a visible <canvas>
export function paintAvatar(el, id, ink) {
  const s = 128;
  if (el.width !== s) { el.width = s; el.height = s; }
  const ctx = el.getContext('2d');
  ctx.clearRect(0, 0, s, s);
  ctx.fillStyle = '#f7f2e4'; ctx.fillRect(0, 0, s, s);
  ctx.drawImage(avatarCanvas(id, ink, s), 0, 0);
}
