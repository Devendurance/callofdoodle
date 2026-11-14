// Profiles, XP / levels, unlocks, settings and doodle avatars.
const KEY = 'doodlestrike.v1';

export const DEFAULT_SETTINGS = {
  sens: 1, adsMode: 'tap', assist: true, sfx: true, vib: true, bots: 7, diff: 'normal',
  quality: 'auto', full: true, fps: false,
  // HUD customisation
  hudScale: 1, hudAlpha: 1, xhStyle: 'cross', xhColor: '#1c1c26', showFeed: true, showTop3: true, showHint: true,
  hudLayout: {},
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
  for (const g of GUNS) if (g.lv > a && g.lv <= b) out.push(`${CLASSES[g.cls].short}: ${g.name}`);
  for (const e of [...LETHALS, ...TACTICALS]) if (e.lv > a && e.lv <= b) out.push(`Equipment: ${e.name}`);
  return out;
}

function blankStats() {
  return { matches: 0, wins: 0, top3: 0, kills: 0, deaths: 0, headshots: 0, shots: 0, hits: 0, bestStreak: 0, timePlayed: 0, points: 0 };
}
export function newProfile(name, avatar = 0, ink = 0) {
  return { id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name, avatar, ink, xp: 0, created: Date.now(), stats: blankStats(), loadout: { ...DEFAULT_LOADOUT, guns: [...DEFAULT_LOADOUT.guns] } };
}

export const store = {
  data: null,
  load() {
    try { this.data = JSON.parse(localStorage.getItem(KEY)); } catch { this.data = null; }
    if (!this.data || !Array.isArray(this.data.profiles)) this.data = { profiles: [], activeId: null, settings: {} };
    this.data.settings = { ...DEFAULT_SETTINGS, ...this.data.settings };
    if (!this.data.settings.hudLayout || typeof this.data.settings.hudLayout !== 'object') this.data.settings.hudLayout = {};
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

// ---------------------------------------------------------------- loadout: guns + equipment
// fall = [full-damage range, min-damage range, min-damage multiplier] in metres
export const CLASSES = {
  ar: { name: 'Assault Rifles', short: 'AR' },
  smg: { name: 'SMGs', short: 'SMG' },
  sniper: { name: 'Sniper Rifles', short: 'Sniper' },
  shotgun: { name: 'Shotguns', short: 'Shotgun' },
};
const gun = (id, cls, name, lv, o) => {
  const base = {
    ar: { auto: true, pellets: 1, head: 1.6, fov: 52, ads: 0.005, adsSpd: 1, tint: '#d9d6cf' },
    smg: { auto: true, pellets: 1, head: 1.5, fov: 58, ads: 0.01, adsSpd: 1.25, tint: '#cfd6d9' },
    sniper: { auto: false, pellets: 1, head: 2.0, fov: 20, spread: 0.08, ads: 0, adsSpd: 0.85, tint: '#c9b58f' },
    shotgun: { auto: false, pellets: 8, head: 1.3, fov: 60, ads: 0.05, adsSpd: 1.15, tint: '#d4b8a0' },
  }[cls];
  const g = { id, cls, name, lv, ...base, ...o };
  const resMul = cls === 'ar' || cls === 'smg' ? [4, 8] : [4, 6];
  g.reserveStart = g.mag * resMul[0]; g.reserveMax = g.mag * resMul[1];
  return g;
};
export const GUNS = [
  gun('ak117', 'ar', 'AK117', 1, { dmg: 21, rate: 0.08, mag: 30, reload: 2.0, spread: 0.022, ads: 0.005, recoil: 0.010, mob: 1.0, fall: [26, 55, 0.65], desc: 'Fast-firing all-rounder with a tame kick.', accent: '#f2b632' }),
  gun('type19', 'ar', 'Type 19', 6, { dmg: 19, rate: 0.072, mag: 32, reload: 1.8, spread: 0.024, ads: 0.006, recoil: 0.011, mob: 1.04, fall: [24, 50, 0.6], desc: 'Light and twitchy. Shreds at mid range.', accent: '#3d7fe0' }),
  gun('bal27', 'ar', 'BAL27', 15, { dmg: 23, rate: 0.085, mag: 30, reload: 2.2, spread: 0.018, ads: 0.0035, recoil: 0.008, mob: 0.97, fall: [32, 65, 0.7], desc: 'Laser-accurate. Wins long lane fights.', accent: '#2fa858' }),
  gun('ak47', 'ar', 'AK-47', 24, { dmg: 30, rate: 0.11, mag: 30, reload: 2.4, spread: 0.026, ads: 0.006, recoil: 0.016, mob: 0.95, fall: [34, 70, 0.7], desc: 'Hard-hitting classic. Tame the recoil and it rules.', accent: '#a8642c', tint: '#c9a27a' }),
  gun('uss9', 'smg', 'USS9', 1, { dmg: 17, rate: 0.07, mag: 32, reload: 1.6, spread: 0.028, ads: 0.01, recoil: 0.008, mob: 1.1, fall: [12, 30, 0.5], desc: 'Dependable bullet hose for close quarters.', accent: '#e0473f' }),
  gun('vmp', 'smg', 'VMP', 8, { dmg: 15, rate: 0.055, mag: 40, reload: 1.9, spread: 0.03, ads: 0.011, recoil: 0.009, mob: 1.12, fall: [11, 26, 0.45], desc: 'Absurd fire rate and a big mag.', accent: '#8a3fc8' }),
  gun('switchblade', 'smg', 'Switchblade X9', 12, { dmg: 19, rate: 0.068, mag: 30, reload: 1.4, spread: 0.026, ads: 0.009, recoil: 0.009, mob: 1.13, fall: [13, 30, 0.5], desc: 'Snappy handling, fastest reload in the bag.', accent: '#e85aa8' }),
  gun('statichv', 'smg', 'Static-HV', 20, { dmg: 22, rate: 0.082, mag: 30, reload: 1.7, spread: 0.024, ads: 0.008, recoil: 0.010, mob: 1.08, fall: [16, 36, 0.55], desc: 'Heavy SMG that reaches further than it should.', accent: '#2a9cb0' }),
  gun('dlq', 'sniper', 'DL Q33', 1, { dmg: 105, rate: 1.1, mag: 5, reload: 2.6, recoil: 0.06, mob: 0.88, fov: 20, adsSpd: 1, fall: [90, 200, 1], desc: 'The classic bolt-action. Balanced in every way.', accent: '#2a2a35' }),
  gun('koshka', 'sniper', 'Koshka', 10, { dmg: 140, rate: 1.5, mag: 5, reload: 3.0, recoil: 0.07, mob: 0.84, fov: 16, adsSpd: 0.75, fall: [110, 220, 1], desc: 'Hardest hitter in the notebook, but slow and heavy.', accent: '#d8352c' }),
  gun('locus', 'sniper', 'Locus', 18, { dmg: 110, rate: 0.95, mag: 6, reload: 2.4, recoil: 0.055, mob: 0.9, fov: 22, adsSpd: 1.05, fall: [85, 190, 1], desc: 'Quicker bolt and a bigger mag.', accent: '#2f5fd0' }),
  gun('tundra', 'sniper', 'Tundra', 28, { dmg: 125, rate: 1.2, mag: 4, reload: 2.6, recoil: 0.065, mob: 0.88, fov: 18, adsSpd: 1.25, fall: [100, 210, 1], desc: 'Lightning scope-in for quick-scopers.', accent: '#7fb4d8' }),
  gun('hs0405', 'shotgun', 'HS0405', 3, { dmg: 20, rate: 0.85, mag: 4, reload: 2.6, spread: 0.07, recoil: 0.05, mob: 1.02, fall: [5, 13, 0.1], desc: 'Pump-action. One clean pump at arm\'s length.', accent: '#a8642c' }),
  gun('by15', 'shotgun', 'BY15', 5, { dmg: 22, rate: 0.95, mag: 5, reload: 2.8, spread: 0.06, recoil: 0.055, mob: 1.0, fall: [6, 15, 0.1], desc: 'Hard-hitting pump with a tighter spread.', accent: '#2fa858' }),
  gun('striker', 'shotgun', 'Striker', 22, { dmg: 13, rate: 0.28, mag: 12, reload: 3.0, spread: 0.075, recoil: 0.04, mob: 1.0, fall: [5, 12, 0.1], desc: 'Semi-auto drum. Keep pulling the trigger.', accent: '#f07a1a' }),
  gun('krm', 'shotgun', 'KRM-262', 32, { dmg: 21, rate: 0.8, mag: 8, reload: 3.2, spread: 0.055, recoil: 0.05, mob: 0.98, pellets: 9, fall: [7, 17, 0.12], desc: 'Long-range pump with a deep tube.', accent: '#8a3fc8' }),
];
export const GUN = Object.fromEntries(GUNS.map(g => [g.id, g]));

// 0-100 ratings shown on the loadout bars, derived from the real numbers above
export function gunRatings(g) {
  const c = (v) => Math.round(Math.max(5, Math.min(100, v)));
  const hit = g.dmg * g.pellets * (g.pellets > 1 ? 0.7 : 1);
  const rpm = 60 / g.rate;
  const acc = g.cls === 'shotgun' ? 100 - g.spread * 800 : 100 - g.ads * 3000 - g.recoil * 700;
  return {
    Damage: c(Math.sqrt(hit / 140) * 100),
    Range: c(Math.sqrt(g.fall[1] / 200) * 100),
    'Fire rate': c((Math.log(rpm) - Math.log(40)) / (Math.log(1100) - Math.log(40)) * 100),
    Accuracy: c(acc),
    Mobility: c((g.mob - 0.75) / 0.4 * 100),
    Handling: c(100 - g.reload * 20 + g.adsSpd * 20),
  };
}

export const LETHALS = [
  { id: 'frag', name: 'Frag Grenade', lv: 1, max: 2, desc: 'Cook it, bounce it, BOOM. Big blast radius.' },
  { id: 'sticky', name: 'Sticky Doodle', lv: 4, max: 2, desc: 'Sticks to the first thing it touches, then pops.' },
  { id: 'fire', name: 'Hot Sauce', lv: 9, max: 2, desc: 'Bursts on impact into a pool of burning ink.' },
  { id: 'cluster', name: 'Cluster Scribble', lv: 14, max: 1, desc: 'Splits into four bomblets after the first blast.' },
  { id: 'mine', name: 'Paper Mine', lv: 19, max: 2, desc: 'Lands and waits. Blows when a rival walks near.' },
];
export const TACTICALS = [
  { id: 'ink', name: 'Ink Bomb', lv: 1, max: 2, desc: 'A thick ink cloud that blocks vision and bullets.' },
  { id: 'flash', name: 'Flash Doodle', lv: 3, max: 2, desc: 'Blinds anyone looking at it for a few seconds.' },
  { id: 'concussion', name: 'Eraser Shock', lv: 7, max: 2, desc: 'Slows movement and aim of anyone caught in it.' },
  { id: 'stim', name: 'Snack Break', lv: 11, max: 1, desc: 'Eat it: instantly heal back to full health.' },
];
export const EQUIP = Object.fromEntries([...LETHALS, ...TACTICALS].map(e => [e.id, e]));
export const DEFAULT_LOADOUT = { guns: ['ak117', 'dlq'], lethal: 'frag', tactical: 'ink' };

// Returns the profile's loadout with anything locked or unknown swapped for a default.
export function loadoutFor(prof) {
  const lvl = levelInfo(prof.xp).level;
  const lo = { ...DEFAULT_LOADOUT, ...(prof.loadout || {}) };
  const ok = (id, list) => list.find(x => x.id === id && x.lv <= lvl);
  let guns = (lo.guns || []).filter(id => ok(id, GUNS));
  for (const d of DEFAULT_LOADOUT.guns) if (guns.length < 2 && !guns.includes(d)) guns.push(d);
  guns = guns.slice(0, 2);
  return { guns, lethal: ok(lo.lethal, LETHALS) ? lo.lethal : 'frag', tactical: ok(lo.tactical, TACTICALS) ? lo.tactical : 'ink' };
}
