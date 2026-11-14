import * as THREE from 'three';
import { buildMap, BoxBuilder, doodleMaterial, shared, moveBody, rayWorld, lineClear, SPAWNS, PICKUPS, validateSpots, inkClouds } from './world.js';
import { Bot, BOT_NAMES, BOT_INKS, makeFighter, charMaterial, outlineMaterial, angDiff } from './bots.js';
import { FX, makeTextures, makeGrenadeMesh, stepGrenade, Pickups } from './fx.js';
import { store, AVATARS, INKS, levelInfo, titleFor, unlocksBetween, newProfile, paintAvatar, MAX_LEVEL, GUNS, GUN, CLASSES, gunRatings, LETHALS, TACTICALS, EQUIP, loadoutFor, DEFAULT_SETTINGS } from './data.js';
import { audio } from './audio.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const WIN_SCORE = 20;
const TIME_CAP = 15 * 60;
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (isTouch) document.body.classList.add('touch');

store.load();
audio.enabled = store.settings.sfx;

// ====================================================================== renderer
const canvas = $('#gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.autoClear = false;
renderer.setClearColor(0xf7f2e4);
function pixelRatio() {
  const q = store.settings.quality, d = window.devicePixelRatio || 1;
  return q === 'low' ? Math.min(d, 1) : q === 'high' ? Math.min(d, 2) : Math.min(d, isTouch ? 1.5 : 1.75);
}
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, 1, 0.05, 220);
camera.rotation.order = 'YXZ';
const vmScene = new THREE.Scene();
const vmCam = new THREE.PerspectiveCamera(60, 1, 0.01, 10);
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setPixelRatio(pixelRatio());
  renderer.setSize(w, h, false);
  camera.aspect = vmCam.aspect = w / h;
  camera.updateProjectionMatrix(); vmCam.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

buildMap(scene);
const bad = validateSpots();
if (bad.length) console.warn('blocked spots', bad);
const tex = makeTextures();
const fx = new FX(scene, tex);
const pickups = new Pickups(scene, tex, PICKUPS);

// ====================================================================== viewmodel
const VM = {};
(function buildViewmodel() {
  const root = new THREE.Group(); vmScene.add(root); VM.root = root;
  const mat = doodleMaterial({ edge: 1.4, fog: false, hatch: 0.8 });
  VM.models = {};
  VM.model = (g) => {
    if (VM.models[g.id]) return VM.models[g.id];
    const t = g.tint, a = g.accent, bb = new BoxBuilder(10);
    if (g.cls === 'ar') {
      bb.box(0, 0, -0.1, 0.07, 0.09, 0.42, t); bb.box(0, 0.005, -0.42, 0.035, 0.035, 0.26, '#bdbab3');
      bb.box(0, -0.075, -0.06, 0.045, 0.1, 0.06, t); bb.box(0, -0.09, -0.18, 0.045, 0.13, 0.05, a);
      bb.box(0, -0.005, 0.15, 0.055, 0.075, 0.14, t); bb.box(0, 0.065, -0.1, 0.02, 0.04, 0.12, '#bdbab3');
      bb.box(0, -0.015, -0.3, 0.06, 0.06, 0.14, g.id === 'ak47' ? '#a8642c' : '#9fc4ef');
    } else if (g.cls === 'smg') {
      bb.box(0, 0, -0.08, 0.07, 0.09, 0.3, t); bb.box(0, 0.005, -0.28, 0.035, 0.035, 0.12, '#9a9aa2');
      bb.box(0, -0.075, -0.02, 0.045, 0.1, 0.05, t); bb.box(0, -0.11, -0.13, 0.04, 0.16, 0.045, a);
      bb.box(0, 0, 0.12, 0.03, 0.05, 0.14, '#9a9aa2'); bb.box(0, 0.06, -0.08, 0.02, 0.03, 0.08, a);
    } else if (g.cls === 'sniper') {
      bb.box(0, 0, -0.08, 0.06, 0.08, 0.5, t); bb.box(0, 0.01, -0.55, 0.03, 0.03, 0.44, '#9a9aa2');
      bb.box(0, 0.085, -0.1, 0.05, 0.05, 0.26, '#2a2a35'); bb.box(0, 0.085, -0.25, 0.065, 0.065, 0.04, a);
      bb.box(0, -0.07, -0.02, 0.045, 0.1, 0.06, t); bb.box(0, -0.06, -0.14, 0.04, 0.06, 0.06, a);
      bb.box(0, -0.01, 0.2, 0.06, 0.1, 0.18, t);
    } else {
      bb.box(0, 0, -0.06, 0.075, 0.09, 0.3, t); bb.box(0, 0.015, -0.4, 0.045, 0.045, 0.42, '#8a8a92');
      bb.box(0, -0.035, -0.36, 0.04, 0.035, 0.34, '#8a8a92'); bb.box(0, -0.04, -0.3, 0.065, 0.06, 0.14, a);
      bb.box(0, -0.075, 0.0, 0.045, 0.1, 0.06, t); bb.box(0, -0.01, 0.18, 0.06, 0.1, 0.2, t);
      if (g.id === 'striker') bb.box(0, -0.1, -0.12, 0.12, 0.12, 0.08, a);
    }
    const m = new THREE.Mesh(bb.build(), mat); m.visible = false; root.add(m);
    return (VM.models[g.id] = m);
  };
  // doodle hands holding the gun
  const skin = charMaterial('#fbf8ef');
  const mkHand = () => { const h = new THREE.Group(); const m = new THREE.Mesh(new THREE.SphereGeometry(0.032, 10, 8), skin); const o = new THREE.Mesh(m.geometry, outlineMaterial(0.006)); h.add(m, o);
    const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.026, 0.16, 4, 8), skin); const fo = new THREE.Mesh(f.geometry, outlineMaterial(0.006)); f.position.set(0, -0.09, 0.03); fo.position.copy(f.position); f.rotation.x = fo.rotation.x = 0.5; h.add(f, fo); return h; };
  const arm = mkHand(); arm.position.set(0.005, -0.075, -0.03); root.add(arm);
  const arm2 = mkHand(); arm2.position.set(-0.01, -0.05, -0.3); arm2.scale.setScalar(0.95); root.add(arm2); VM.arm2 = arm2;
  VM.flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.flash, transparent: true, depthTest: false }));
  VM.flash.scale.set(0.22, 0.22, 1); VM.flash.visible = false; root.add(VM.flash);
  VM.base = new THREE.Vector3(0.17, -0.165, -0.38);
  VM.ads = { ar: new THREE.Vector3(0, -0.1, -0.34), smg: new THREE.Vector3(0, -0.1, -0.3), sniper: new THREE.Vector3(0, -0.13, -0.3), shotgun: new THREE.Vector3(0, -0.11, -0.34) };
  VM.muzzle = { ar: -0.6, smg: -0.36, sniper: -0.82, shotgun: -0.64 };
  VM.grip = { ar: -0.3, smg: -0.2, sniper: -0.3, shotgun: -0.3 };
})();

// ====================================================================== state
const S = { mode: 'menu', paused: false, board: false };
const G = {
  scene, tex, fx, time: 0, fighters: [], bots: [], pickups: pickups.list, grenades: [], playerHitMul: 1,
  botShot, player: null, killFeed: [], matchStart: 0, over: false, fireZones: [],
};
window.__G = G; // debug handle

const LETHAL_IDS = new Set(LETHALS.map(e => e.id));
const BOT_LETHALS = ['frag', 'frag', 'sticky', 'fire', 'cluster'];
const BOT_TACTICALS = ['flash', 'concussion'];
const BOT_CLASS_W = [['ar', 0.35], ['smg', 0.27], ['sniper', 0.18], ['shotgun', 0.2]];
function randomBotGun() {
  let r = Math.random(), cls = 'ar';
  for (const [c, w] of BOT_CLASS_W) { if ((r -= w) <= 0) { cls = c; break; } }
  const opts = GUNS.filter(g => g.cls === cls);
  return opts[(Math.random() * opts.length) | 0];
}
const weaponName = (id) => GUN[id]?.name || EQUIP[id]?.name || (id === 'bomblet' ? 'Cluster Scribble' : '');

function makePlayer(profile) {
  const p = makeFighter({ id: 0, name: profile.name, isPlayer: true, avatar: profile.avatar, ink: INKS[profile.ink]?.c || '#2a2a35' });
  Object.assign(p, {
    pitch: 0, wi: 0, guns: [], ammo: [0, 0], reserve: [0, 0], lethal: 'frag', tactical: 'ink', lethalN: 0, tactN: 0,
    reloading: 0, swapT: 0, cool: 0, firing: false, firedThisPress: false, ads: false, adsK: 0, recoil: 0, recoilYaw: 0,
    bob: 0, stepT: 0, shots: 0, hits: 0, xpEvents: [], killer: null, blindT: 0, slowT: 0, gunKills: {},
  });
  p.body.r = 0.38;
  return p;
}
const W = () => G.player.guns[G.player.wi];
// fresh loadout every life (changes made in the Loadout screen apply on the next spawn)
function applyLoadout(p) {
  const lo = loadoutFor(store.active);
  p.guns = lo.guns.map(id => GUN[id]);
  p.ammo = p.guns.map(g => g.mag); p.reserve = p.guns.map(g => g.reserveStart);
  p.lethal = lo.lethal; p.tactical = lo.tactical;
  p.lethalN = EQUIP[lo.lethal].max; p.tactN = EQUIP[lo.tactical].max;
  if (p.wi > 1) p.wi = 0;
  setWeaponCards(p.guns); setEquipButtons(p.lethal, p.tactical);
}

// ====================================================================== match lifecycle
function startMatch() {
  audio.init();
  const prof = store.active; if (!prof) return showScreen('sEdit');
  const st = store.settings;
  for (const b of G.bots) b.dispose();
  fx.clear(); for (const n of G.grenades) scene.remove(n.mesh); G.grenades = []; G.fireZones = [];
  pickups.reset();
  G.time = 0; G.over = false; G.killFeed = []; $('#feed').innerHTML = '';
  G.playerHitMul = st.diff === 'easy' ? 0.75 : st.diff === 'hard' ? 1.15 : 1;
  const player = G.player = makePlayer(prof);
  const names = [...BOT_NAMES].sort(() => Math.random() - 0.5);
  const inks = [...BOT_INKS].sort(() => Math.random() - 0.5);
  G.bots = [];
  for (let i = 0; i < st.bots; i++) {
    const b = new Bot(G, { name: names[i], avatar: (i + 1 + ((Math.random() * 3) | 0)) % AVATARS.length, ink: inks[i % inks.length], gun: randomBotGun() }, st.diff);
    b.lethal = BOT_LETHALS[(Math.random() * BOT_LETHALS.length) | 0]; b.tactical = BOT_TACTICALS[(Math.random() * 2) | 0];
    b.nades = 2; b.tacts = 1; b.nadeCool = 8 + Math.random() * 10;
    G.bots.push(b);
  }
  G.fighters = [player, ...G.bots];
  const spots = [...SPAWNS].sort(() => Math.random() - 0.5);
  G.fighters.forEach((f, i) => { if (f.isPlayer) spawnPlayer(spots[i]); else f.spawn(spots[i]); });
  $('#menuBots').textContent = st.bots;
  clearHudDemo(); applyHud();
  updateWeaponHUD(); refreshHUD(true);
  $('#bSound').classList.toggle('muted', !st.sfx);
  $('#fps').classList.toggle('hidden', !st.fps);
  S.mode = 'playing'; S.paused = false; S.board = false;
  showScreen(null);
  $('#hud').classList.remove('hidden');
  $('#board').classList.add('hidden');
  $('#deathScreen').classList.add('hidden');
  if (isTouch && st.full) goFullscreen();
  if (!isTouch) lockPointer();
  centerMsg('FIRST TO 20!', 'Free-for-all — every NPC is a rival', 2.2);
}
function spawnPlayer(spot) {
  const p = G.player, b = p.body;
  if (!spot) spot = pickSpawn(p);
  b.x = spot.x; b.z = spot.z; b.y = 0; b.vy = 0;
  p.yaw = Math.atan2(b.x, b.z); p.pitch = 0;
  p.hp = 100; p.armor = 50; p.alive = true; p.streak = 0; p.protectUntil = G.time + 2;
  applyLoadout(p);
  p.blindT = 0; p.slowT = 0; $('#flashOverlay').style.opacity = 0; $('#shockOverlay').style.opacity = 0;
  p.reloading = 0; p.swapT = 0; p.ads = false; p.crouch = false; p.vel.x = p.vel.z = 0;
  $('#bScope').classList.remove('on'); $('#bCrouch').classList.remove('on');
  updateWeaponHUD();
}
function pickSpawn(f) {
  const scored = SPAWNS.map(s => {
    let md = 1e9;
    for (const o of G.fighters) if (o !== f && o.alive) md = Math.min(md, Math.hypot(o.body.x - s.x, o.body.z - s.z));
    return { s, md: md + Math.random() * 6 };
  }).sort((a, b) => b.md - a.md);
  return scored[(Math.random() * 3) | 0].s;
}
function standings() {
  return [...G.fighters].sort((a, b) => b.score - a.score || b.kills - a.kills || a.deaths - b.deaths || (a.isPlayer ? -1 : 1));
}

// ====================================================================== combat
function damage(victim, attacker, amount, opts = {}) {
  if (!victim.alive || G.over) return;
  if (G.time < victim.protectUntil) return;
  if (victim.armor > 0) { const ab = Math.min(victim.armor, amount * 0.5); victim.armor -= ab; amount -= ab; }
  victim.hp -= amount;
  victim.lastAttacker = attacker; victim.lastHurtAt = G.time;
  if (!victim.isPlayer) victim.hurt(attacker);
  if (victim.isPlayer) playerHurt(attacker, amount);
  if (victim.hp <= 0) kill(victim, attacker, opts);
}
function kill(victim, attacker, opts) {
  victim.hp = 0; victim.alive = false; victim.deaths++; victim.streak = 0;
  victim.respawnAt = G.time + 3;
  const pos = new THREE.Vector3(victim.body.x, victim.body.y + 1, victim.body.z);
  fx.poof(pos);
  const self = !attacker || attacker === victim;
  if (self) victim.score = Math.max(0, victim.score - 1);
  else {
    attacker.score++; attacker.kills++; attacker.streak++; attacker.bestStreak = Math.max(attacker.bestStreak, attacker.streak);
    if (opts.head) attacker.headshots++;
    if (attacker.isPlayer && opts.weapon) attacker.gunKills[opts.weapon] = (attacker.gunKills[opts.weapon] || 0) + 1;
  }
  addFeed(attacker, victim, opts);
  if (!victim.isPlayer) victim.die();
  else playerDied(attacker, opts);
  if (attacker && attacker.isPlayer && !self) playerKill(victim, opts);
  if (!self && attacker.score >= WIN_SCORE) endMatch(attacker);
}
function botShot(bot, from, to, victim, dmg, head, g) {
  const sniper = g.cls === 'sniper';
  fx.tracer(from, to, sniper ? 0.18 : 0.06, sniper ? 1.6 : g.cls === 'shotgun' ? 1.4 : 1);
  const pd = Math.hypot(G.player.body.x - bot.body.x, G.player.body.z - bot.body.z);
  audio.play('enemyShot', clamp(1.1 - pd / 40, 0.05, 1) * (sniper || g.cls === 'shotgun' ? 1.3 : 0.8));
  if (victim) damage(victim, bot, dmg, { head, weapon: g.id });
  else {
    const d = to.clone().sub(from).normalize(), out = {};
    const t = rayWorld(from.x, from.y, from.z, d.x, d.y, d.z, 80, out);
    if (t < 80 && Math.random() < 0.5) fx.splat(from.clone().addScaledVector(d, t), new THREE.Vector3(out.nx, out.ny, out.nz));
  }
}
const _o = new THREE.Vector3(), _d = new THREE.Vector3(), _n = {}, _b = new THREE.Vector3(), _r = new THREE.Vector3(), _u = new THREE.Vector3();
function playerFire() {
  const p = G.player, w = W(), i = p.wi, cls = w.cls;
  if (p.reloading > 0 || p.swapT > 0 || p.cool > 0) return;
  if (p.ammo[i] <= 0) { if (p.reserve[i] > 0) startReload(); else { audio.play('empty'); p.cool = 0.25; } return; }
  p.ammo[i]--; p.cool = w.rate; p.shots++;
  const sniper = cls === 'sniper', shotgun = cls === 'shotgun', heavy = sniper || shotgun;
  const moving = Math.hypot(p.vel.x, p.vel.z) > 1 || !p.body.onGround;
  let spread = shotgun ? w.spread * (p.adsK > 0.7 ? 0.75 : 1) : p.adsK > 0.7 ? w.ads : w.spread;
  if (moving) spread += sniper ? 0.04 : shotgun ? 0.006 : cls === 'smg' ? 0.007 : 0.012;
  if (p.crouch) spread *= 0.7;
  spread += p.recoil * 0.3;
  if (p.slowT > 0) spread *= 1.4;
  camera.getWorldPosition(_o);
  _b.set(0, 0, -1).applyQuaternion(camera.quaternion);
  _r.set(1, 0, 0).applyQuaternion(camera.quaternion); _u.set(0, 1, 0).applyQuaternion(camera.quaternion);
  const muzzle = _o.clone().addScaledVector(_b, 0.6).addScaledVector(_r, 0.18).addScaledVector(_u, -0.16);
  const assist = isTouch && store.settings.assist ? 1 : 0;
  const hits = new Map();
  for (let k = 0; k < w.pellets; k++) {
    const r = shotgun ? Math.sqrt(Math.random()) * spread : Math.random() * spread, a = Math.random() * Math.PI * 2;
    _d.copy(_b).addScaledVector(_r, Math.cos(a) * r).addScaledVector(_u, Math.sin(a) * r).normalize();
    const wallT = rayWorld(_o.x, _o.y, _o.z, _d.x, _d.y, _d.z, 200, _n);
    let hitBot = null, hit = null;
    for (const b of G.bots) {
      const h = b.hitTest(_o, _d, shotgun ? assist * 0.5 : assist);
      if (h && h.t < wallT && (!hit || h.t < hit.t)) {
        if (!lineClear(_o.x, _o.y, _o.z, _o.x + _d.x * h.t, _o.y + _d.y * h.t, _o.z + _d.z * h.t, true)) continue; // ink clouds block bullets too
        hit = h; hitBot = b;
      }
    }
    const endT = hit ? hit.t : Math.min(wallT, 120);
    const end = _o.clone().addScaledVector(_d, endT);
    if (!shotgun || k % 2 === 0) fx.tracer(muzzle, end, sniper ? 0.25 : 0.05, sniper ? 2 : 1);
    if (hitBot) {
      let dmg = w.dmg * (hit.head ? w.head : 1);
      const [f0, f1, fm] = w.fall;
      dmg *= hit.t <= f0 ? 1 : hit.t >= f1 ? fm : 1 - (1 - fm) * (hit.t - f0) / (f1 - f0);
      const e = hits.get(hitBot) || { dmg: 0, head: false };
      e.dmg += dmg; e.head = e.head || hit.head; hits.set(hitBot, e);
      if (!shotgun || k % 3 === 0) fx.hitPuff(end);
    } else if (wallT < 120 && (!shotgun || Math.random() < 0.35)) {
      fx.splat(end, new THREE.Vector3(_n.nx, _n.ny, _n.nz));
    }
  }
  if (hits.size) {
    p.hits++;
    let anyHead = false, killed = false;
    for (const [b, h] of hits) {
      const wasAlive = b.alive;
      damage(b, p, Math.round(h.dmg), { head: h.head, weapon: w.id });
      anyHead = anyHead || h.head; killed = killed || (wasAlive && !b.alive);
    }
    hitMarker(anyHead ? 'head' : '', killed);
    audio.play(anyHead ? 'head' : 'hit');
  }
  audio.play(sniper ? 'sniper' : shotgun ? 'shotgun' : cls === 'smg' ? 'smg' : 'rifle', 0.9);
  p.recoil += w.recoil; p.pitch += w.recoil * (heavy ? 1 : 0.55); p.recoilYaw += (Math.random() - 0.5) * w.recoil * 0.6;
  VM.kick = heavy ? 1 : cls === 'smg' ? 0.35 : 0.45; VM.flashT = 0.04;
  if (sniper && p.ads) { setADS(false); }
  vibrate(heavy ? 25 : 8);
  if (p.ammo[i] === 0 && p.reserve[i] > 0) setTimeout(() => { if (G.player === p && p.wi === i && p.ammo[i] === 0) startReload(); }, 250);
  updateWeaponHUD();
}
function startReload() {
  const p = G.player, w = W(), i = p.wi;
  if (p.reloading > 0 || p.ammo[i] >= w.mag || p.reserve[i] <= 0 || !p.alive) return;
  p.reloading = w.reload; setADS(false); audio.play('reload');
  $('#bReload').classList.add('busy');
}
function finishReload() {
  const p = G.player, w = W(), i = p.wi;
  const need = w.mag - p.ammo[i], take = Math.min(need, p.reserve[i]);
  p.ammo[i] += take; p.reserve[i] -= take; $('#bReload').classList.remove('busy');
  updateWeaponHUD();
}
function switchWeapon(i) {
  const p = G.player; if (!p || i === p.wi || !p.alive) return;
  p.wi = i; p.swapT = 0.35; p.reloading = 0; $('#bReload').classList.remove('busy'); setADS(false);
  audio.play('swap'); updateWeaponHUD();
}
function setADS(on) {
  const p = G.player; if (!p) return;
  if (on && (p.reloading > 0 || p.swapT > 0 || !p.alive)) return;
  p.ads = on; $('#bScope').classList.toggle('on', on);
}
const FUSE = { frag: 2.0, sticky: 1.6, fire: 3.0, cluster: 1.8, bomblet: 0.7, mine: 60, ink: 1.4, flash: 1.3, concussion: 1.4 };
function throwNade(owner, type, origin, dir, power = 15) {
  const mesh = makeGrenadeMesh(type); scene.add(mesh);
  const n = { owner, type, x: origin.x, y: origin.y, z: origin.z, vx: dir.x * power, vy: dir.y * power + 3, vz: dir.z * power,
    fuse: FUSE[type] + (type === 'bomblet' ? Math.random() * 0.5 : 0), mesh, stuck: false, stuckTo: null, landed: false, armT: 0, triggered: false };
  n.onBounce = (v, nrm) => {
    if (v > 2) audio.play('step', 0.5);
    if (type === 'ink' && v > 1) n.fuse = Math.min(n.fuse, 0.25);
    if (type === 'fire' && v > 1) n.fuse = 0;
    if (type === 'sticky' && !n.stuck) { n.stuck = true; n.vx = n.vy = n.vz = 0; audio.play('beep', 0.6); }
    if (type === 'mine' && nrm && nrm.ny > 0.5 && !n.landed && v < 6) { n.landed = true; n.armT = 1; }
  };
  G.grenades.push(n);
  if (type !== 'bomblet') audio.play('throw');
  return n;
}
function playerThrow(slot) {
  const p = G.player; if (!p.alive) return;
  const id = slot === 'lethal' ? p.lethal : p.tactical, key = slot === 'lethal' ? 'lethalN' : 'tactN';
  if (p[key] <= 0) { audio.play('empty'); return; }
  p[key]--;
  if (id === 'stim') {
    p.hp = 100; audio.play('stim'); pickupMsg('Snack break! Back to full health'); $('#vignette').style.opacity = 0;
    updateWeaponHUD(); return;
  }
  camera.getWorldPosition(_o); _d.set(0, 0, -1).applyQuaternion(camera.quaternion);
  const dir = _d.clone(); dir.y += 0.12; dir.normalize();
  throwNade(p, id, _o.clone().addScaledVector(_d, 0.5), dir, id === 'mine' ? 9 : 16);
  VM.throwT = 0.35; updateWeaponHUD();
}
function blast(n, R, maxDmg, weapon) {
  const pos = new THREE.Vector3(n.x, n.y, n.z);
  fx.boom(pos, R); audio.play('boom', soundVol(pos) * (R > 4 ? 1.2 : 0.8));
  const pd = G.player.body;
  const dd = Math.hypot(pd.x - n.x, pd.y + 1 - n.y, pd.z - n.z);
  if (dd < R * 2.5) { G.shake = Math.max(G.shake || 0, 0.35 * (1 - dd / (R * 2.5))); vibrate(60); }
  for (const f of G.fighters) {
    if (!f.alive) continue;
    const b = f.body, d = Math.hypot(b.x - n.x, b.y + 0.9 - n.y, b.z - n.z);
    if (d > R) continue;
    if (!lineClear(n.x, n.y + 0.3, n.z, b.x, b.y + 1.0, b.z, false)) continue;
    let dmg = maxDmg * (1 - d / R) ** 0.8;
    if (f === n.owner) dmg *= 0.5;
    damage(f, n.owner, Math.round(dmg), { weapon });
  }
}
function explode(n) {
  const pos = new THREE.Vector3(n.x, n.y, n.z);
  switch (n.type) {
    case 'ink': fx.inkCloud(pos); audio.play('ink', soundVol(pos)); return;
    case 'flash': return flashBang(n, pos);
    case 'concussion': return concussion(n, pos);
    case 'fire': {
      blast(n, 3, 45, 'fire'); audio.play('fire', soundVol(pos));
      G.fireZones.push({ x: n.x, y: Math.max(0, n.y - 0.2), z: n.z, r: 3.2, t: 5, tick: 0, owner: n.owner });
      for (let i = 0; i < 7; i++) { const a = Math.random() * 7, d = Math.random() * 2.4;
        fx.sprite(tex.fire, new THREE.Vector3(n.x + Math.cos(a) * d, n.y + 0.4, n.z + Math.sin(a) * d), 1.3 + Math.random() * 0.6, 5, { rot: (Math.random() - 0.5) * 0.3, grow: 1.1 }); }
      return;
    }
    case 'cluster': {
      blast(n, 4.5, 100, 'cluster');
      for (let i = 0; i < 4; i++) {
        const a = i / 4 * Math.PI * 2 + Math.random() * 0.6;
        throwNade(n.owner, 'bomblet', new THREE.Vector3(n.x, n.y + 0.3, n.z), new THREE.Vector3(Math.cos(a), 0.5, Math.sin(a)).normalize(), 5 + Math.random() * 2);
      }
      return;
    }
    case 'bomblet': return blast(n, 3.2, 70, 'cluster');
    case 'sticky': return blast(n, 4.5, 140, 'sticky');
    case 'mine': return blast(n, 4.5, 140, 'mine');
    default: return blast(n, 5.5, 125, 'frag');
  }
}
function flashBang(n, pos) {
  fx.sprite(tex.flashb, new THREE.Vector3(n.x, n.y + 0.6, n.z), 3.2, 0.45, { grow: 1.6 });
  audio.play('flashbang', soundVol(pos) * 1.2);
  for (const f of G.fighters) {
    if (!f.alive) continue;
    const b = f.body, ey = b.y + 1.5, d = Math.hypot(b.x - n.x, ey - n.y, b.z - n.z);
    if (d > 24 || !lineClear(n.x, n.y + 0.2, n.z, b.x, ey, b.z, true)) continue;
    let facing;
    if (f.isPlayer) {
      camera.getWorldPosition(_o); _d.set(0, 0, -1).applyQuaternion(camera.quaternion);
      facing = ((n.x - _o.x) * _d.x + (n.y - _o.y) * _d.y + (n.z - _o.z) * _d.z) / (d || 1);
    } else facing = ((n.x - b.x) * -Math.sin(f.yaw) + (n.z - b.z) * -Math.cos(f.yaw)) / (Math.hypot(n.x - b.x, n.z - b.z) || 1);
    const k = clamp((facing + 0.4) / 1.4, 0.2, 1) * clamp(1.15 - d / 24, 0.25, 1);
    const dur = 0.6 + 3.4 * k;
    f.blindT = Math.max(f.blindT || 0, dur);
    if (f.isPlayer) { f.blindMax = f.blindT; vibrate(80); }
    else { f.visible = false; f.scanT = 0; }
  }
}
function concussion(n, pos) {
  fx.sprite(tex.shock, new THREE.Vector3(n.x, n.y + 0.5, n.z), 3, 0.6, { grow: 2.4 });
  audio.play('shock', soundVol(pos));
  for (const f of G.fighters) {
    if (!f.alive) continue;
    const b = f.body, d = Math.hypot(b.x - n.x, b.y + 1 - n.y, b.z - n.z);
    if (d > 7 || !lineClear(n.x, n.y + 0.3, n.z, b.x, b.y + 1, b.z, false)) continue;
    f.slowT = Math.max(f.slowT || 0, 1.5 + 3 * (1 - d / 7));
    if (f.isPlayer) { G.shake = Math.max(G.shake || 0, 0.3); vibrate(60); }
    if (f !== n.owner) damage(f, n.owner, Math.round(12 * (1 - d / 7)) + 1, { weapon: 'concussion' });
  }
}
function updateFire(dt) {
  for (let i = G.fireZones.length - 1; i >= 0; i--) {
    const z = G.fireZones[i]; z.t -= dt; z.tick -= dt;
    if (z.t <= 0) { G.fireZones.splice(i, 1); continue; }
    if (z.tick > 0) continue;
    z.tick = 0.25;
    for (const f of G.fighters) {
      if (!f.alive) continue;
      const b = f.body;
      if (Math.hypot(b.x - z.x, b.z - z.z) > z.r || b.y - z.y > 1.4 || b.y < z.y - 1) continue;
      damage(f, z.owner, f === z.owner ? 3 : 6, { weapon: 'fire' });
    }
  }
}
function soundVol(pos) { const b = G.player.body; return clamp(1.2 - Math.hypot(b.x - pos.x, b.z - pos.z) / 45, 0.05, 1); }

// ====================================================================== player events / HUD feedback
function playerHurt(attacker, amount) {
  audio.play('hurt', 0.8); vibrate(30);
  $('#vignette').style.opacity = clamp(0.35 + amount / 50, 0, 1);
  setTimeout(() => { $('#vignette').style.opacity = G.player && G.player.hp < 35 && G.player.alive ? 0.45 : 0; }, 180);
  if (attacker && attacker !== G.player) {
    const b = G.player.body;
    const ang = Math.atan2(-(attacker.body.x - b.x), -(attacker.body.z - b.z));
    const rel = angDiff(G.player.yaw, ang);
    const el = document.createElement('div'); el.className = 'dd';
    el.style.transform = `rotate(${-rel}rad)`;
    $('#dmgdir').appendChild(el); setTimeout(() => el.remove(), 1000);
  }
}
function playerDied(attacker, opts) {
  const p = G.player;
  p.killer = attacker && attacker !== p ? attacker : null;
  setADS(false); p.firing = false;
  $('#deathScreen').classList.remove('hidden');
  const wn = weaponName(opts.weapon);
  $('#killedBy').innerHTML = p.killer ? `erased by <b style="color:${p.killer.ink}">${esc(p.killer.name)}</b>${wn ? ` with the ${esc(wn)}` : ''}${opts.head ? ' (headshot)' : ''}` : 'you erased yourself!';
  p.blindT = 0; p.slowT = 0; $('#flashOverlay').style.opacity = 0; $('#shockOverlay').style.opacity = 0;
  vibrate([40, 40, 80]);
}
function playerKill(victim, opts) {
  const p = G.player;
  const ev = [['Kill', 100]];
  if (opts.head) ev.push(['Headshot', 50]);
  if (LETHAL_IDS.has(opts.weapon) || opts.weapon === 'cluster') ev.push(['Equipment kill', 40]);
  if (GUN[opts.weapon]?.cls === 'shotgun' && opts.head) ev.push(['Point blank', 20]);
  if (p.streak === 3) ev.push(['Streak x3', 100]);
  if (p.streak === 5) ev.push(['Streak x5', 200]);
  if (p.streak === 8) ev.push(['Unstoppable x8', 350]);
  if (victim.score >= standings()[0].score && victim.score >= 5) ev.push(['Leader takedown', 75]);
  const now = G.time;
  if (p.lastKillAt && now - p.lastKillAt < 3) { p.multi = (p.multi || 1) + 1; ev.push([p.multi === 2 ? 'Double kill' : 'Multi kill', 60]); }
  else p.multi = 1;
  p.lastKillAt = now;
  for (const e of ev) p.xpEvents.push(e);
  const total = ev.reduce((s, e) => s + e[1], 0);
  floater(`+${total} XP`);
  audio.play('kill');
  const left = WIN_SCORE - p.score;
  if (p.multi >= 2) centerMsg(p.multi === 2 ? 'DOUBLE KILL!' : 'MULTI KILL!', '', 1.2);
  else if (p.streak === 3 || p.streak === 5 || p.streak === 8) centerMsg(`${p.streak} IN A ROW!`, '', 1.4);
  else if (left === 5 || left === 1) centerMsg(left === 1 ? 'ONE MORE!' : '5 TO GO!', '', 1.2);
  else if (opts.head) centerMsg('HEADSHOT!', '', 0.8);
}
function addFeed(att, vic, opts) {
  const el = document.createElement('div');
  el.className = 'fe' + (att?.isPlayer || vic.isPlayer ? ' me' : '');
  const g = GUN[opts.weapon];
  const icon = !g ? '&#x2738;' : g.cls === 'sniper' ? '&#x2316;' : g.cls === 'shotgun' ? '&#x2234;' : '&#x2192;';
  const wn = weaponName(opts.weapon);
  const name = (f) => `<b style="color:${f.ink}">${esc(f.isPlayer ? 'You' : f.name)}</b>`;
  el.innerHTML = !att || att === vic ? `${name(vic)} tripped over a pencil` : `${name(att)} <span class="wpn">${icon} ${esc(wn)}</span> ${name(vic)}${opts.head ? ' <span class="hs">HS</span>' : ''}`;
  const feed = $('#feed'); feed.prepend(el);
  while (feed.children.length > 4) feed.lastChild.remove();
  setTimeout(() => el.remove(), 5000);
}
let hmT = 0;
function hitMarker(kind, killed) {
  const h = $('#hitmark'); h.className = ''; void h.offsetWidth;
  h.className = 'on' + (kind === 'head' ? ' head' : '') + (killed ? ' kill' : '');
  clearTimeout(hmT); hmT = setTimeout(() => (h.className = ''), 460);
}
let cmT = 0;
function centerMsg(big, small = '', dur = 1.5) {
  const el = $('#centerMsg'); el.innerHTML = `${esc(big)}${small ? `<small>${esc(small)}</small>` : ''}`; el.classList.add('on');
  clearTimeout(cmT); cmT = setTimeout(() => el.classList.remove('on'), dur * 1000);
}
function floater(text) {
  const el = document.createElement('div'); el.className = 'fl'; el.textContent = text;
  el.style.left = `${(Math.random() - 0.5) * 60}px`;
  $('#floaters').appendChild(el); setTimeout(() => el.remove(), 1200);
}
let pmT = 0;
function pickupMsg(t) { const el = $('#pickupMsg'); el.textContent = t; el.classList.add('on'); clearTimeout(pmT); pmT = setTimeout(() => el.classList.remove('on'), 1200); }
function vibrate(p) { if (store.settings.vib && navigator.vibrate) try { navigator.vibrate(p); } catch {} }
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

// HUD
const hudCache = {};
function setText(id, v) { if (hudCache[id] !== v) { hudCache[id] = v; document.getElementById(id).textContent = v; } }
function setStyle(id, prop, v) { const k = id + prop; if (hudCache[k] !== v) { hudCache[k] = v; document.getElementById(id).style[prop] = v; } }
function refreshHUD(force) {
  const p = G.player; if (!p) return;
  if (force) for (const k in hudCache) delete hudCache[k];
  setText('hpNum', String(Math.ceil(p.hp))); setStyle('hpFill', 'width', `${p.hp}%`);
  setText('armorNum', String(Math.ceil(p.armor))); setStyle('armorFill', 'width', `${p.armor}%`);
  $('#hud').classList.toggle('lowhp', p.alive && p.hp < 35);
  const st = standings();
  const lead = st[0] === p ? st[1] : st[0];
  setText('sYou', String(p.score)); setStyle('sbYou', 'width', `${p.score / WIN_SCORE * 100}%`);
  setText('sLead', String(lead ? lead.score : 0)); setStyle('sbLead', 'width', `${(lead ? lead.score : 0) / WIN_SCORE * 100}%`);
  setText('sLeadName', lead ? lead.name : '-');
  const key = st.slice(0, 3).map(f => f.id + ':' + f.score).join(',');
  if (hudCache.top3 !== key || force) {
    hudCache.top3 = key;
    const box = $('#top3'); box.innerHTML = '';
    st.slice(0, 3).forEach((f, i) => {
      const row = document.createElement('div'); row.className = 't3' + (f.isPlayer ? ' me' : '');
      const c = document.createElement('canvas'); paintAvatar(c, f.avatar, f.ink);
      const n = document.createElement('div'); n.className = 'n'; n.innerHTML = `${i + 1}. ${esc(f.isPlayer ? 'You' : f.name)} <b>${f.score}</b>`;
      row.append(c, n); box.appendChild(row);
    });
  }
  if (S.board) renderBoard();
}
const GUN_SVG = {
  ar: '<path d="M2 11h34l3-3h10v4h12M49 12v3h-10l-2 1H22l-2 6h-6l2-6H4v-5M24 16v4h4M8 8h12"/>',
  smg: '<path d="M10 9h30v2h10M50 11v3H38l-1 2H26l-2 5h-5l2-5H12v-5M30 16v6h4v-6M4 11h6v3H4zM20 6h8"/>',
  sniper: '<path d="M2 12h40h18M4 12v3h12l-2 5h6l2-5h10M14 8h16v-3h-16z M30 12v3"/>',
  shotgun: '<path d="M2 10h54M2 13h50M24 13v3h-9l-3 5h-6l2-5H4v-6M30 14h14v3H30z"/>',
};
const EQ_SVG = {
  frag: '<ellipse cx="12" cy="14.5" rx="6" ry="6.8"/><path d="M10 7.8V5.5h4v2.3M14 5.5c2-2 4.5-1.2 5 1M8.5 12.5h7M8.5 16.5h7"/>',
  sticky: '<ellipse cx="12" cy="12" rx="6" ry="6.5"/><path d="M8 17.5v3M12 18.5v3.5M16 17.5v2.5M10 6V4h4v2"/>',
  fire: '<path d="M10 3h4v4l2 3v10H8V10l2-3z"/><path d="M12 12c2 2 2 4 0 6c-2-2-2-4 0-6z"/>',
  cluster: '<circle cx="8" cy="9" r="3.5"/><circle cx="16" cy="9" r="3.5"/><circle cx="12" cy="16" r="3.5"/>',
  mine: '<ellipse cx="12" cy="15" rx="8" ry="3.5"/><path d="M4 15v-2.5c0-2 16-2 16 0V15M12 9.5V7"/><circle cx="12" cy="6" r="1"/>',
  ink: '<path d="M12 3c3 5 6.5 8 6.5 11.5a6.5 6.5 0 0 1-13 0C5.5 11 9 8 12 3z"/><path d="M9 15a3 3 0 0 0 3 3"/>',
  flash: '<path d="M12 2.5l2.2 6.3 6.6.2-5.2 4 1.9 6.4-5.5-3.8-5.5 3.8 1.9-6.4-5.2-4 6.6-.2z"/>',
  concussion: '<circle cx="12" cy="12" r="2.5"/><path d="M6.5 6.5a8 8 0 0 0 0 11M17.5 6.5a8 8 0 0 1 0 11M3.5 4a12 12 0 0 0 0 16M20.5 4a12 12 0 0 1 0 16"/>',
  stim: '<path d="M4 11h16l-1.5 8h-13zM6 11c0-4 12-4 12 0M9 7.5l1-3M15 7.5l-1-3"/>',
};
function setWeaponCards(guns) {
  guns.forEach((g, i) => {
    const el = $(`#w${i}`);
    el.querySelector('svg').innerHTML = GUN_SVG[g.cls];
    el.querySelector('.wn').textContent = g.name;
  });
}
function setEquipButtons(lethal, tactical) {
  $('#bFrag svg').innerHTML = EQ_SVG[lethal]; $('#bFrag').setAttribute('aria-label', EQUIP[lethal].name);
  $('#bInk svg').innerHTML = EQ_SVG[tactical]; $('#bInk').setAttribute('aria-label', EQUIP[tactical].name);
}
function updateWeaponHUD() {
  const p = G.player; if (!p) return;
  for (let i = 0; i < 2; i++) {
    $(`#w${i}ammo`).textContent = `${p.ammo[i]}/${p.reserve[i]}`;
    $(`#w${i}`).classList.toggle('active', p.wi === i);
    $(`#w${i}`).classList.toggle('empty', p.ammo[i] === 0);
  }
  $('#fragN').textContent = p.lethalN; $('#inkN').textContent = p.tactN;
  $('#bFrag').classList.toggle('empty', p.lethalN <= 0); $('#bInk').classList.toggle('empty', p.tactN <= 0);
}
function renderBoard() {
  const st = standings();
  const el = $('#board');
  el.innerHTML = `<table class="tbl"><tr><th>#</th><th>Doodler</th><th class="num">Pts</th><th class="num">K</th><th class="num">D</th></tr>${st.map((f, i) =>
    `<tr class="${f.isPlayer ? 'me' : ''}"><td>${i + 1}</td><td><div class="nm"><canvas data-av="${f.avatar}" data-ink="${f.ink}"></canvas>${esc(f.isPlayer ? f.name + ' (you)' : f.name)}</div></td><td class="num"><b>${f.score}</b></td><td class="num">${f.kills}</td><td class="num">${f.deaths}</td></tr>`).join('')}</table>
    <p style="text-align:center;font-size:2.4vh;opacity:.7;margin:1vh 0 0">Tap to close</p>`;
  el.querySelectorAll('canvas').forEach(c => paintAvatar(c, +c.dataset.av, c.dataset.ink));
}
function toggleBoard(on = !S.board) { S.board = on; $('#board').classList.toggle('hidden', !on); if (on) renderBoard(); }

// ====================================================================== end of match + XP
function endMatch(winner) {
  if (G.over) return;
  G.over = true; S.mode = 'end';
  const p = G.player;
  const st = standings(); const place = st.indexOf(p) + 1;
  const won = winner === p || (winner == null && place === 1);
  audio.play(won ? 'win' : 'lose');
  setTimeout(() => showEnd(place, won, winner), 1600);
  centerMsg(won ? 'VICTORY!' : `${winner ? winner.name : st[0].name} WINS`, '', 1.6);
  setADS(false); p.firing = false;
  if (document.pointerLockElement) document.exitPointerLock();
}
function awardXP(complete, place) {
  const prof = store.active, p = G.player;
  const lines = [];
  const agg = {};
  for (const [k, v] of p.xpEvents) { agg[k] = agg[k] || [0, 0]; agg[k][0]++; agg[k][1] += v; }
  for (const k in agg) lines.push([agg[k][0] > 1 ? `${k} x${agg[k][0]}` : k, agg[k][1]]);
  if (complete) {
    lines.push(['Match complete', 150]);
    lines.push([place === 1 ? '1st place!' : place === 2 ? '2nd place' : place === 3 ? '3rd place' : `${place}th place`, [0, 600, 350, 200][place] || 50]);
  }
  const total = lines.reduce((s, l) => s + l[1], 0);
  const before = levelInfo(prof.xp);
  prof.xp += total;
  const after = levelInfo(prof.xp);
  const s = prof.stats;
  s.kills += p.kills; s.deaths += p.deaths; s.headshots += p.headshots; s.shots += p.shots; s.hits += p.hits;
  s.bestStreak = Math.max(s.bestStreak, p.bestStreak); s.timePlayed += G.time; s.points += p.score;
  prof.gunKills = prof.gunKills || {};
  for (const k in p.gunKills) prof.gunKills[k] = (prof.gunKills[k] || 0) + p.gunKills[k];
  p.gunKills = {};
  if (complete) { s.matches++; if (place === 1) s.wins++; if (place <= 3) s.top3++; }
  store.save();
  return { lines, total, before, after };
}
function showEnd(place, won) {
  const p = G.player;
  const { lines, total, before, after } = awardXP(true, place);
  $('#hud').classList.add('hidden');
  $('#endTitle').textContent = won ? 'VICTORY!' : place <= 3 ? 'SO CLOSE!' : 'ERASED...';
  $('#endSub').textContent = `You placed ${ordinal(place)} of ${G.fighters.length} · ${p.kills} kills · ${p.deaths} deaths · ${p.headshots} headshots`;
  const st = standings();
  $('#endTable').innerHTML = `<table class="tbl"><tr><th>#</th><th>Doodler</th><th class="num">Pts</th><th class="num">K/D</th></tr>${st.map((f, i) =>
    `<tr class="${f.isPlayer ? 'me' : ''}"><td>${i + 1}</td><td><div class="nm"><canvas data-av="${f.avatar}" data-ink="${f.ink}"></canvas>${esc(f.isPlayer ? f.name + ' (you)' : f.name)}</div></td><td class="num"><b>${f.score}</b></td><td class="num">${f.kills}/${f.deaths}</td></tr>`).join('')}</table>`;
  $('#endTable').querySelectorAll('canvas').forEach(c => paintAvatar(c, +c.dataset.av, c.dataset.ink));
  $('#endXp').innerHTML = lines.map((l, i) => `<div class="xpl" style="animation-delay:${i * 0.12}s"><span>${esc(l[0])}</span><b>+${l[1]}</b></div>`).join('') +
    `<div class="xpl total" style="animation-delay:${lines.length * 0.12}s"><span>Total XP</span><b>+${total}</b></div>`;
  const lv = $('#endLevel');
  const pct = after.max ? 100 : after.into / after.need * 100;
  const prePct = after.level > before.level ? 0 : (before.into / before.need * 100);
  lv.innerHTML = `<div class="xptxt" style="margin-top:1.4vh"><span>Level ${after.level} · ${esc(titleFor(after.level))}</span><span>${after.max ? 'MAX' : `${after.into} / ${after.need} XP`}</span></div><div class="xpbar"><i style="width:${prePct}%"></i></div>`;
  setTimeout(() => { const i = lv.querySelector('.xpbar i'); if (i) i.style.width = pct + '%'; }, 300 + lines.length * 120);
  if (after.level > before.level) {
    const un = unlocksBetween(before.level, after.level);
    setTimeout(() => {
      lv.insertAdjacentHTML('beforeend', `<div class="lvup">LEVEL UP! ${after.level}</div>${un.length ? `<div class="unl">Unlocked: ${un.map(esc).join(', ')}</div>` : ''}`);
      audio.play('levelup');
    }, 600 + lines.length * 120);
  }
  showScreen('sEnd');
}
function quitMatch() {
  if (G.player && S.mode === 'playing' && !G.over) awardXP(false, 0);
  S.mode = 'menu'; S.paused = false; G.over = true;
  $('#hud').classList.add('hidden');
  showScreen('sMenu');
}
const ordinal = (n) => n + (n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th');

// ====================================================================== input
const input = { jx: 0, jy: 0, lookDX: 0, lookDY: 0, keys: {}, jump: false, sprint: false };
const touches = new Map(); // id -> {kind, x, y, btn, ox, oy}
const joyEl = $('#joy'), knobEl = $('#knob');
function joyRadius() { const s = store.settings; return innerHeight * 0.14 * (s.hudScale || 1) * (s.hudLayout.joy?.s || 1); }
function joyHome() { const r = joyEl.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
let joyCenter = null;
function setKnob(dx, dy) { const k = hudScaleOf('joy'); knobEl.style.transform = `translate(${dx / k}px,${dy / k}px)`; }

function btnDown(name, el) {
  const p = G.player;
  if (el) el.classList.add('pressed');
  audio.init();
  if (S.editing) return;
  if (name === 'pause') return pauseGame();
  if (name === 'sound') { store.settings.sfx = !store.settings.sfx; audio.enabled = store.settings.sfx; store.save(); $('#bSound').classList.toggle('muted', !store.settings.sfx); return; }
  if (name === 'board') return toggleBoard();
  if (S.mode !== 'playing' || S.paused || !p) return;
  if (!p.alive) return;
  switch (name) {
    case 'fire': p.firing = true; p.firedThisPress = false; break;
    case 'scope': setADS(!p.ads); break;
    case 'jump': input.jump = true; break;
    case 'crouch': p.crouch = !p.crouch; $('#bCrouch').classList.toggle('on', p.crouch); break;
    case 'reload': startReload(); break;
    case 'frag': playerThrow('lethal'); break;
    case 'ink': playerThrow('tactical'); break;
    case 'w0': switchWeapon(0); break;
    case 'w1': switchWeapon(1); break;
  }
}
function btnUp(name, el) {
  if (el) el.classList.remove('pressed');
  if (name === 'fire' && G.player) G.player.firing = false;
}
function hudTarget(t) { return t instanceof Element && (t === canvas || t.closest('#hud')); }
addEventListener('touchstart', (e) => {
  if (S.mode !== 'playing' || S.paused) return;
  if (!hudTarget(e.target)) return;
  e.preventDefault();
  for (const t of e.changedTouches) {
    const el = t.target instanceof Element ? t.target.closest('[data-btn]') : null;
    if (S.board && !(el && el.dataset.btn === 'pause')) { toggleBoard(false); continue; }
    if (el) {
      touches.set(t.identifier, { kind: 'btn', btn: el.dataset.btn, el, x: t.clientX, y: t.clientY });
      btnDown(el.dataset.btn, el);
    } else if (t.clientX < innerWidth * 0.42 && t.clientY > innerHeight * 0.18) {
      if ([...touches.values()].some(v => v.kind === 'move')) { touches.set(t.identifier, { kind: 'look', x: t.clientX, y: t.clientY }); continue; }
      // floating joystick: recentre on the thumb
      const r = joyRadius();
      const hx = clamp(t.clientX, r + 10, innerWidth * 0.42 - r * 0.3), hy = clamp(t.clientY, r + 10, innerHeight - r * 0.6);
      joyCenter = { x: hx, y: hy };
      joyEl.classList.add('float');
      joyEl.style.left = `${hx - joyEl.offsetWidth / 2}px`; joyEl.style.top = `${hy - joyEl.offsetHeight / 2}px`; joyEl.style.bottom = 'auto';
      touches.set(t.identifier, { kind: 'move', x: t.clientX, y: t.clientY });
      updateJoy(t.clientX, t.clientY);
    } else {
      touches.set(t.identifier, { kind: 'look', x: t.clientX, y: t.clientY });
    }
  }
}, { passive: false });
addEventListener('touchmove', (e) => {
  if (S.mode !== 'playing') return;
  if (hudTarget(e.target)) e.preventDefault();
  for (const t of e.changedTouches) {
    const s = touches.get(t.identifier); if (!s) continue;
    if (s.kind === 'move') updateJoy(t.clientX, t.clientY);
    else if (s.kind === 'look' || (s.kind === 'btn' && s.btn === 'fire')) {
      input.lookDX += t.clientX - s.x; input.lookDY += t.clientY - s.y;
    }
    s.x = t.clientX; s.y = t.clientY;
  }
}, { passive: false });
function touchEnd(e) {
  for (const t of e.changedTouches) {
    const s = touches.get(t.identifier); if (!s) continue;
    touches.delete(t.identifier);
    if (s.kind === 'btn') btnUp(s.btn, s.el);
    if (s.kind === 'move') { input.jx = input.jy = 0; setKnob(0, 0); joyCenter = null; joyEl.style.left = joyEl.style.top = joyEl.style.bottom = ''; joyEl.classList.remove('float'); }
  }
}
addEventListener('touchend', touchEnd); addEventListener('touchcancel', touchEnd);
function updateJoy(x, y) {
  const c = joyCenter || joyHome(), r = joyRadius();
  let dx = x - c.x, dy = y - c.y; const d = Math.hypot(dx, dy);
  if (d > r) { dx *= r / d; dy *= r / d; }
  setKnob(dx, dy);
  input.jx = dx / r; input.jy = -dy / r;
}
function releaseAllTouches() {
  for (const [, s] of touches) if (s.kind === 'btn') btnUp(s.btn, s.el);
  touches.clear(); input.jx = input.jy = 0; setKnob(0, 0);
}

// mouse / keyboard
$$('#hud [data-btn]').forEach(el => {
  el.addEventListener('mousedown', (e) => { if (isTouchEvent(e)) return; e.stopPropagation(); btnDown(el.dataset.btn, el); });
  el.addEventListener('mouseup', () => btnUp(el.dataset.btn, el));
});
let lastTouchTime = 0;
addEventListener('touchstart', () => { lastTouchTime = performance.now(); }, { capture: true, passive: true });
function isTouchEvent() { return performance.now() - lastTouchTime < 800; }
function lockPointer() { if (!isTouch && canvas.requestPointerLock) { try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch {} } }
canvas.addEventListener('mousedown', (e) => {
  if (isTouchEvent() || S.mode !== 'playing' || S.paused) return;
  if (S.board) { toggleBoard(false); return; }
  if (document.pointerLockElement !== canvas) { lockPointer(); return; }
  const p = G.player; if (!p?.alive) return;
  if (e.button === 0) { p.firing = true; p.firedThisPress = false; }
  if (e.button === 2) setADS(!p.ads);
});
addEventListener('mouseup', (e) => { if (e.button === 0 && G.player) G.player.firing = false; });
addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('mousemove', (e) => {
  if (document.pointerLockElement === canvas && S.mode === 'playing' && !S.paused) { input.lookDX += e.movementX * 0.55; input.lookDY += e.movementY * 0.55; }
});
addEventListener('wheel', (e) => { if (S.mode === 'playing' && G.player) switchWeapon(e.deltaY > 0 ? 1 : 0); });
document.addEventListener('pointerlockchange', () => {
  if (!document.pointerLockElement && S.mode === 'playing' && !S.paused && !isTouch) pauseGame();
});
addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement) return;
  input.keys[e.code] = true;
  if (S.mode !== 'playing') return;
  const p = G.player;
  switch (e.code) {
    case 'Space': input.jump = true; e.preventDefault(); break;
    case 'KeyC': case 'ControlLeft': if (p.alive) { p.crouch = !p.crouch; } break;
    case 'KeyR': startReload(); break;
    case 'Digit1': switchWeapon(0); break;
    case 'Digit2': switchWeapon(1); break;
    case 'KeyQ': switchWeapon(1 - p.wi); break;
    case 'KeyG': playerThrow('lethal'); break;
    case 'KeyF': playerThrow('tactical'); break;
    case 'Tab': e.preventDefault(); toggleBoard(true); break;
    case 'Escape': if (S.paused) resumeGame(); break;
  }
});
addEventListener('keyup', (e) => { input.keys[e.code] = false; if (e.code === 'Tab') toggleBoard(false); });
addEventListener('blur', () => { input.keys = {}; if (G.player) G.player.firing = false; });
document.addEventListener('visibilitychange', () => { if (document.hidden && S.mode === 'playing' && !S.paused) pauseGame(); });

function pauseGame() {
  if (S.mode !== 'playing') return;
  S.paused = true; releaseAllTouches(); if (G.player) G.player.firing = false;
  showScreen('sPause');
}
function resumeGame() {
  S.paused = false; showScreen(null); lockPointer();
}
function goFullscreen() {
  const d = document.documentElement;
  try {
    const r = (d.requestFullscreen || d.webkitRequestFullscreen)?.call(d, { navigationUI: 'hide' });
    if (r && r.then) r.then(() => screen.orientation?.lock?.('landscape').catch(() => {})).catch(() => {});
  } catch {}
}

// ====================================================================== simulation
const tmpV = new THREE.Vector3();
function updatePlayer(dt) {
  const p = G.player, b = p.body, st = store.settings;
  // look
  const zoom = camera.fov / 75;
  let sens = (isTouch ? 0.0052 : 0.0022) * st.sens * zoom;
  if (p.slowT > 0) sens *= 0.45;
  if (p.blindT > 0) { p.blindT -= dt; $('#flashOverlay').style.opacity = clamp(p.blindT / Math.min(1.4, p.blindMax || 1), 0, 1).toFixed(3); }
  if (p.slowT > 0) { p.slowT -= dt; $('#shockOverlay').style.opacity = clamp(p.slowT / 1.5, 0, 0.8).toFixed(3); }
  // aim-assist friction: slow the look when crosshair is on an enemy
  if (isTouch && st.assist && G.onTarget) sens *= 0.6;
  p.yaw -= input.lookDX * sens; p.pitch -= input.lookDY * sens;
  input.lookDX = input.lookDY = 0;
  // recoil recovery
  const rec = Math.min(p.recoil, dt * 0.25); p.recoil -= rec;
  p.yaw += p.recoilYaw * Math.min(1, dt * 10) * 0.5; p.recoilYaw *= Math.max(0, 1 - dt * 10);
  p.pitch = clamp(p.pitch, -1.45, 1.45);

  if (!p.alive) {
    p.firing = false;
    if (p.killer && p.killer.alive) { // death cam: look at killer
      const k = p.killer.body; const want = Math.atan2(-(k.x - b.x), -(k.z - b.z));
      p.yaw += angDiff(p.yaw, want) * Math.min(1, dt * 3);
    }
    const left = Math.max(0, p.respawnAt - G.time);
    setText('respawnIn', left > 0 ? `back in ${left.toFixed(1)}s` : '');
    if (left <= 0) { spawnPlayer(); $('#deathScreen').classList.add('hidden'); $('#vignette').style.opacity = 0; }
    return;
  }

  // movement
  let mx = input.jx, my = input.jy;
  if (!isTouch || (!mx && !my)) {
    const k = input.keys;
    mx += (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0);
    my += (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0);
    const l = Math.hypot(mx, my); if (l > 1) { mx /= l; my /= l; }
  }
  const sprint = (isTouch ? my > 0.85 : input.keys.ShiftLeft && my > 0) && !p.ads && !p.crouch && !p.firing;
  let speed = p.crouch ? 2.6 : sprint ? 7.4 : 5.4;
  if (p.adsK > 0.5) speed *= 0.6;
  speed *= W().mob;
  if (p.slowT > 0) speed *= 0.5;
  const fx_ = -Math.sin(p.yaw), fz = -Math.cos(p.yaw), rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw);
  const tx = (fx_ * my + rx * mx) * speed, tz = (fz * my + rz * mx) * speed;
  const acc = b.onGround ? 14 : 4;
  p.vel.x += (tx - p.vel.x) * Math.min(1, dt * acc); p.vel.z += (tz - p.vel.z) * Math.min(1, dt * acc);
  if (input.jump) {
    if (b.onGround) { b.vy = 7.2; audio.play('jump'); if (p.crouch) { p.crouch = false; $('#bCrouch').classList.remove('on'); } }
    input.jump = false;
  }
  const wantH = p.crouch ? 1.25 : 1.75;
  if (wantH > b.h) { // standing up: check headroom
    const tmp = { ...b, h: wantH };
    let ok = true;
    if (rayWorld(b.x, b.y + b.h, b.z, 0, 1, 0, wantH - b.h + 0.05) < wantH - b.h + 0.05) ok = false;
    if (ok) b.h = wantH; else { p.crouch = true; }
    void tmp;
  } else b.h = wantH;
  const wasGround = b.onGround;
  moveBody(b, p.vel.x * dt, p.vel.z * dt, dt);
  if (!wasGround && b.onGround) { VM.land = 0.5; audio.play('step', 0.8); }
  const hs = Math.hypot(p.vel.x, p.vel.z);
  if (b.onGround && hs > 1) {
    p.bob += dt * hs * 1.7;
    p.stepT -= dt * hs; if (p.stepT <= 0) { p.stepT = 2.6; audio.play('step', 0.5); }
  }
  p.eyeH = (p.eyeH ?? 1.6) + ((p.crouch ? 1.12 : 1.6) - (p.eyeH ?? 1.6)) * Math.min(1, dt * 14);

  // weapons
  p.cool -= dt;
  if (p.swapT > 0) p.swapT -= dt;
  if (p.reloading > 0) { p.reloading -= dt; if (p.reloading <= 0) finishReload(); }
  if (p.firing) {
    const w = W();
    if (w.auto || !p.firedThisPress) { if (p.cool <= 0 && p.reloading <= 0 && p.swapT <= 0) { playerFire(); p.firedThisPress = true; } }
  }
  // touch aim assist: gentle pull while firing
  if (isTouch && st.assist && p.firing && G.assistTarget) {
    const t = G.assistTarget;
    p.yaw += clamp(angDiff(p.yaw, t.yaw), -dt * 0.9, dt * 0.9);
    p.pitch += clamp(t.pitch - p.pitch, -dt * 0.5, dt * 0.5);
  }
  p.adsK += ((p.ads ? 1 : 0) - p.adsK) * Math.min(1, dt * 14 * W().adsSpd);

  // pickups
  for (const pk of pickups.list) {
    if (!pk.active) continue;
    if (Math.hypot(pk.x - b.x, pk.z - b.z) > 1.1 || Math.abs(b.y - pk.gy) > 1.2) continue;
    let took = false;
    if (pk.type === 'health' && p.hp < 100) { p.hp = Math.min(100, p.hp + 50); took = '+50 health'; }
    if (pk.type === 'armor' && p.armor < 100) { p.armor = Math.min(100, p.armor + 50); took = '+50 shield'; }
    if (pk.type === 'ammo' && p.guns.some((g, i) => p.reserve[i] < g.reserveMax)) {
      p.guns.forEach((g, i) => { p.reserve[i] = Math.min(g.reserveMax, p.reserve[i] + g.mag * 2); }); took = '+ammo';
    }
    const lMax = EQUIP[p.lethal].max, tMax = EQUIP[p.tactical].max;
    if (pk.type === 'nade' && (p.lethalN < lMax || p.tactN < tMax)) {
      p.lethalN = Math.min(lMax, p.lethalN + 1); p.tactN = Math.min(tMax, p.tactN + 1); took = `+1 ${EQUIP[p.lethal].name}, +1 ${EQUIP[p.tactical].name}`;
    }
    if (took) { pickups.take(pk, G.time); audio.play('pickup'); pickupMsg(took); updateWeaponHUD(); if (p.hp >= 35) $('#vignette').style.opacity = 0; }
  }
}
function botPickups(bot) {
  if (bot.hp >= 100 && bot.armor >= 100) return;
  for (const pk of pickups.list) {
    if (!pk.active || (pk.type !== 'health' && pk.type !== 'armor')) continue;
    if (Math.hypot(pk.x - bot.body.x, pk.z - bot.body.z) > 1.1) continue;
    if (pk.type === 'health' && bot.hp < 100) { bot.hp = Math.min(100, bot.hp + 50); pickups.take(pk, G.time); }
    else if (pk.type === 'armor' && bot.armor < 100) { bot.armor = Math.min(100, bot.armor + 50); pickups.take(pk, G.time); }
  }
}
function botGrenades(bot, dt) {
  bot.nadeCool -= dt;
  if (bot.nadeCool > 0 || bot.blindT > 0 || !bot.target || !bot.target.alive) return;
  const useTact = bot.tacts > 0 && (bot.nades <= 0 || Math.random() < 0.35);
  if (!useTact && bot.nades <= 0) return;
  const t = bot.target.body, b = bot.body;
  const d = Math.hypot(t.x - b.x, t.z - b.z);
  if (d < 7 || d > 20) return;
  bot.nadeCool = 10 + Math.random() * 12;
  if (useTact) bot.tacts--; else bot.nades--;
  const dir = new THREE.Vector3(t.x - b.x, 0, t.z - b.z).normalize();
  const power = clamp(d * 0.75, 7, 15);
  dir.y = 0.35; dir.normalize();
  throwNade(bot, useTact ? bot.tactical : bot.lethal, new THREE.Vector3(b.x, b.y + 1.6, b.z), dir, power);
}
function updateGrenades(dt) {
  for (let i = G.grenades.length - 1; i >= 0; i--) {
    const n = G.grenades[i];
    if (n.stuckTo) {
      if (!n.stuckTo.alive) n.stuckTo = null;
      else { const b = n.stuckTo.body; n.x = b.x + n.ox; n.y = b.y + n.oy; n.z = b.z + n.oz; }
    } else if (n.stuck) { /* stuck to the world */ }
    else if (n.landed) { n.vx = n.vz = 0; n.vy = 0; }
    else {
      stepGrenade(n, dt);
      if (n.type === 'sticky') for (const f of G.fighters) {
        if (f === n.owner || !f.alive) continue;
        const b = f.body;
        if (Math.hypot(b.x - n.x, b.z - n.z) < b.r + 0.25 && n.y > b.y && n.y < b.y + b.h + 0.2) {
          n.stuck = true; n.stuckTo = f; n.ox = n.x - b.x; n.oy = n.y - b.y; n.oz = n.z - b.z; audio.play('beep', 0.7);
          if (f.isPlayer) pickupMsg('STUCK! Get away from people!');
          break;
        }
      }
    }
    n.mesh.position.set(n.x, n.y, n.z);
    if (!n.landed && !n.stuck) n.mesh.rotation.x += dt * 8;
    if (n.type === 'mine') {
      if (n.landed) {
        n.armT -= dt; n.mesh.rotation.set(0, 0, 0);
        const led = n.mesh.userData.led; if (led) led.visible = n.armT > 0 || ((G.time * (n.triggered ? 10 : 2)) | 0) % 2 === 0;
        if (n.armT <= 0 && !n.triggered) for (const f of G.fighters) {
          if (f === n.owner || !f.alive || G.time < f.protectUntil) continue;
          if (Math.hypot(f.body.x - n.x, f.body.z - n.z) < 2.4 && Math.abs(f.body.y - n.y) < 1.6) { n.triggered = true; n.fuse = 0.4; audio.play('beep', soundVol(n)); break; }
        }
      }
      if (!n.triggered && !n.owner.alive) { n.triggered = true; n.fuse = Math.min(n.fuse, 0.3); } // mines fizzle when the owner dies
    }
    n.fuse -= dt;
    if (n.fuse <= 0) { explode(n); scene.remove(n.mesh); G.grenades.splice(i, 1); }
  }
}
function computeAimInfo() {
  const p = G.player; if (!p?.alive) { G.onTarget = false; G.assistTarget = null; return; }
  camera.getWorldPosition(_o); _d.set(0, 0, -1).applyQuaternion(camera.quaternion);
  const wallT = rayWorld(_o.x, _o.y, _o.z, _d.x, _d.y, _d.z, 200);
  let on = false;
  for (const b of G.bots) { const h = b.hitTest(_o, _d, 0.6); if (h && h.t < wallT) { on = true; break; } }
  G.onTarget = on;
  $('#xhair').classList.toggle('enemy', on);
  // nearest enemy within a small cone for aim assist
  let best = null, bestA = 0.09;
  for (const b of G.bots) {
    if (!b.alive) continue;
    const bx = b.body.x - _o.x, by = b.body.y + 1.1 * b.group.scale.y - _o.y, bz = b.body.z - _o.z, dist = Math.hypot(bx, by, bz);
    if (dist > 45) continue;
    const cos = (bx * _d.x + by * _d.y + bz * _d.z) / dist, a = Math.acos(clamp(cos, -1, 1));
    if (a < bestA && lineClear(_o.x, _o.y, _o.z, b.body.x, b.body.y + 1.1, b.body.z)) { bestA = a; best = { yaw: Math.atan2(-bx, -bz), pitch: Math.atan2(by, Math.hypot(bx, bz)) }; }
  }
  G.assistTarget = best;
}

// ====================================================================== camera + viewmodel
function updateCamera(dt) {
  const p = G.player, b = p.body;
  const w = W();
  const fov = 75 + (w.fov - 75) * p.adsK;
  if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
  const bobA = p.alive && b.onGround ? Math.min(1, Math.hypot(p.vel.x, p.vel.z) / 5) * (1 - p.adsK * 0.85) : 0;
  let sx = 0, sy = 0;
  if (G.shake > 0) { G.shake -= dt; sx = (Math.random() - 0.5) * G.shake * 0.3; sy = (Math.random() - 0.5) * G.shake * 0.3; }
  const deadDrop = p.alive ? 0 : 0.9;
  camera.position.set(b.x, b.y + (p.eyeH ?? 1.6) - deadDrop + Math.abs(Math.sin(p.bob)) * 0.05 * bobA, b.z);
  camera.rotation.set(p.pitch + sy, p.yaw + sx, p.alive ? Math.sin(p.bob) * 0.006 * bobA : 0.25);
  const scoped = w.cls === 'sniper' && p.adsK > 0.85 && p.alive;
  $('#scopeOverlay').classList.toggle('on', scoped);
  $('#xhair').classList.toggle('scoped', scoped || !p.alive);
  // crosshair spread
  const moving = Math.hypot(p.vel.x, p.vel.z) > 1 || !b.onGround;
  const gap = (1.0 + (moving ? 1.2 : 0) + p.recoil * 60) * (1 - p.adsK * 0.6) * (w.cls === 'sniper' ? 1.6 : w.cls === 'shotgun' ? 2.6 : w.cls === 'smg' ? 1.2 : 1);
  setStyle('xhair', '--g', `${gap.toFixed(2)}vh`);
  document.getElementById('xhair').style.setProperty('--g', `${gap.toFixed(2)}vh`);

  // viewmodel
  const r = VM.root;
  const model = VM.model(w);
  if (VM.cur !== model) { if (VM.cur) VM.cur.visible = false; model.visible = true; VM.cur = model; }
  r.visible = p.alive && !scoped;
  const ads = VM.ads[w.cls];
  const t = G.time;
  VM.kick = Math.max(0, (VM.kick || 0) - dt * 8);
  VM.land = Math.max(0, (VM.land || 0) - dt * 3);
  VM.throwT = Math.max(0, (VM.throwT || 0) - dt);
  const reloadK = p.reloading > 0 ? Math.sin(clamp(1 - p.reloading / w.reload, 0, 1) * Math.PI) : 0;
  const swapK = p.swapT > 0 ? p.swapT / 0.35 : 0;
  const sprintK = Math.hypot(p.vel.x, p.vel.z) > 6.5 ? 1 : 0;
  VM.sprint = (VM.sprint || 0) + (sprintK - (VM.sprint || 0)) * Math.min(1, dt * 8);
  const bx = Math.cos(p.bob) * 0.012 * bobA, by = -Math.abs(Math.sin(p.bob)) * 0.012 * bobA;
  r.position.lerpVectors(VM.base, ads, p.adsK);
  r.position.x += bx + Math.sin(t * 1.3) * 0.002 + VM.sprint * 0.04;
  r.position.y += by + Math.sin(t * 1.7) * 0.003 - reloadK * 0.12 - swapK * 0.25 - VM.land * 0.03 - VM.throwT * 0.3 - VM.sprint * 0.04;
  r.position.z += VM.kick * 0.06;
  r.rotation.set(VM.kick * 0.12 + reloadK * 0.6, VM.sprint * 0.5, reloadK * 0.4 + VM.sprint * 0.25);
  // muzzle flash at the barrel tip
  VM.flashT = Math.max(0, (VM.flashT || 0) - dt);
  VM.flash.visible = VM.flashT > 0;
  VM.flash.position.set(0, 0.01, VM.muzzle[w.cls]);
  VM.flash.material.rotation = Math.random() * 6;
  VM.arm2.position.z = VM.grip[w.cls] - (w.cls === 'shotgun' && p.cool > w.rate * 0.4 ? -0.08 : 0);
  VM.arm2.visible = w.cls !== 'sniper' || p.adsK < 0.5;
}

// ====================================================================== main loop
let last = performance.now(), fpsAcc = 0, fpsN = 0, hudT = 0;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.05, (now - last) / 1000); last = now;
  fpsAcc += dt; fpsN++;
  if (fpsAcc > 0.5) { if (store.settings.fps) $('#fps').textContent = `${Math.round(fpsN / fpsAcc)} fps`; fpsAcc = 0; fpsN = 0; }
  const running = (S.mode === 'playing' && !S.paused) || S.mode === 'end';
  if (S.mode === 'menu' || S.mode === 'screens') { menuCam(now / 1000, dt); }
  else if (running && G.player) {
    G.time += dt; shared.uT.value = Math.floor(G.time * 6) / 6 * 0.37; // boiling-line effect at 6fps
    if (S.mode === 'playing' && !G.over) {
      updatePlayer(dt);
      for (const bot of G.bots) {
        if (!bot.alive) { if (G.time >= bot.respawnAt) bot.spawn(pickSpawn(bot)); continue; }
        bot.update(dt); botPickups(bot); botGrenades(bot, dt);
      }
      if (G.time > TIME_CAP) endMatch(standings()[0]);
    } else {
      for (const bot of G.bots) if (bot.alive) bot.update(dt * 0.3);
    }
    updateGrenades(dt);
    if (S.mode === 'playing' && !G.over) updateFire(dt);
    fx.update(dt);
    pickups.update(G.time);
    updateCamera(dt);
    for (const bot of G.bots) bot.billboard(camera);
    computeAimInfo();
    hudT -= dt; if (hudT <= 0) { hudT = 0.1; refreshHUD(); }
  } else if (G.player) { updateCamera(0); for (const bot of G.bots) bot.billboard(camera); }
  renderer.clear();
  renderer.render(scene, camera);
  if (S.mode === 'playing' && G.player && VM.root.visible) { renderer.clearDepth(); renderer.render(vmScene, vmCam); }
}
function menuCam(t, dt) {
  shared.uT.value = Math.floor(t * 4) / 4 * 0.37;
  const a = t * 0.05;
  camera.fov = 70; camera.updateProjectionMatrix();
  camera.position.set(Math.sin(a) * 24, 7, Math.cos(a) * 24);
  camera.rotation.set(-0.22, a, 0);
  fx.update(dt);
}

// ====================================================================== screens / profiles UI
function showScreen(id) {
  $$('.screen').forEach(s => s.classList.toggle('on', s.id === id));
  if (id && S.mode !== 'playing' && S.mode !== 'end') S.mode = 'menu';
  if (id === 'sMenu') { S.mode = 'menu'; renderMenu(); }
  if (id === 'sProfiles') renderProfiles();
  if (id === 'sSettings') renderSettings();
  if (id === 'sLoadout') renderLoadout();
}
let backTo = 'sMenu';
$$('[data-back]').forEach(b => b.addEventListener('click', () => showScreen(S.paused ? 'sPause' : backTo)));
function click(sel, fn) { $(sel).addEventListener('click', () => { audio.init(); audio.play('click'); fn(); }); }
click('#btnPlay', () => startMatch());
click('#btnProfiles', () => { backTo = 'sMenu'; showScreen('sProfiles'); });
click('#btnSettings', () => { backTo = 'sMenu'; showScreen('sSettings'); });
click('#btnHow', () => { backTo = 'sMenu'; showScreen('sHow'); });
click('#btnResume', () => resumeGame());
click('#btnPauseSettings', () => showScreen('sSettings'));
click('#btnLoadout', () => { backTo = 'sMenu'; showScreen('sLoadout'); });
click('#btnPauseLoadout', () => showScreen('sLoadout'));
click('#btnHudEdit', () => enterHudEdit());
click('#btnQuit', () => quitMatch());
click('#btnAgain', () => startMatch());
click('#btnEndMenu', () => { S.mode = 'menu'; showScreen('sMenu'); });
click('#btnNewProfile', () => openEdit(null));
click('#btnReset', () => { if (confirm('Erase all profiles, XP and settings?')) { store.reset(); ensureProfile(); } });

function profileCard(prof) {
  const li = levelInfo(prof.xp), s = prof.stats;
  const kd = s.deaths ? (s.kills / s.deaths).toFixed(2) : s.kills.toFixed(2);
  const acc = s.shots ? Math.round(s.hits / s.shots * 100) + '%' : '-';
  return `<div class="pc-top"><canvas class="pav"></canvas><div><div class="pc-name">${esc(prof.name)}</div><div class="pc-title">${esc(titleFor(li.level))}</div><span class="lvl">LEVEL ${li.level}</span></div></div>
    <div class="xpbar"><i style="width:${li.max ? 100 : li.into / li.need * 100}%"></i></div>
    <div class="xptxt"><span>${li.max ? 'MAX LEVEL' : `${li.into} / ${li.need} XP`}</span><span>${li.max ? '' : `Lv ${li.level + 1} next`}</span></div>
    <div class="stats">
      <div><b>${s.matches}</b>matches</div><div><b>${s.wins}</b>wins</div><div><b>${s.top3}</b>top 3</div>
      <div><b>${s.kills}</b>kills</div><div><b>${kd}</b>K/D</div><div><b>${s.headshots}</b>headshots</div>
      <div><b>${acc}</b>accuracy</div><div><b>${s.bestStreak}</b>best streak</div><div><b>${Math.round(s.timePlayed / 60)}m</b>played</div>
    </div>`;
}
function renderMenu() {
  const prof = store.active; if (!prof) return;
  const el = $('#menuProfile');
  el.innerHTML = profileCard(prof) + `<button class="doodle-box pc-change" id="btnChange">Switch / edit profile</button>`;
  paintAvatar(el.querySelector('.pav'), prof.avatar, INKS[prof.ink].c);
  el.querySelector('#btnChange').onclick = () => { audio.play('click'); backTo = 'sMenu'; showScreen('sProfiles'); };
  $('#menuBots').textContent = store.settings.bots;
  const lo = loadoutFor(prof);
  $('#menuLoadout').textContent = `${GUN[lo.guns[0]].name} + ${GUN[lo.guns[1]].name} · ${EQUIP[lo.lethal].name} · ${EQUIP[lo.tactical].name}`;
}
let selProfile = null;
function renderProfiles() {
  const d = store.data;
  if (!selProfile || !d.profiles.find(p => p.id === selProfile)) selProfile = store.active?.id;
  const list = $('#profList'); list.innerHTML = '';
  for (const p of d.profiles) {
    const b = document.createElement('button');
    b.className = 'doodle-box pitem' + (p.id === selProfile ? ' sel' : '') + (p.id === store.active?.id ? ' active-p' : '');
    const c = document.createElement('canvas'); paintAvatar(c, p.avatar, INKS[p.ink].c);
    const t = document.createElement('div'); t.innerHTML = `${esc(p.name)}<small>Level ${levelInfo(p.xp).level}</small>`;
    b.append(c, t);
    b.onclick = () => { selProfile = p.id; audio.play('click'); renderProfiles(); };
    list.appendChild(b);
  }
  const p = d.profiles.find(x => x.id === selProfile);
  const det = $('#profDetail');
  if (!p) { det.innerHTML = ''; return; }
  det.innerHTML = `<div class="pcard doodle-box" style="transform:none;min-width:0">${profileCard(p)}
    <div class="row" style="margin-top:1.6vh">
      ${p.id === store.active?.id ? '<button class="doodle-box" disabled style="opacity:.6">Playing as this profile</button>' : '<button class="doodle-box primary" id="btnUse">Play as this profile</button>'}
      <button class="doodle-box" id="btnEdit">Edit</button>
    </div></div>`;
  paintAvatar(det.querySelector('.pav'), p.avatar, INKS[p.ink].c);
  const use = det.querySelector('#btnUse'); if (use) use.onclick = () => { d.activeId = p.id; store.save(); audio.play('click'); toast(`Playing as ${p.name}`); renderProfiles(); };
  det.querySelector('#btnEdit').onclick = () => openEdit(p);
}
let editing = null, editAv = 0, editInk = 0;
function openEdit(p) {
  editing = p; editAv = p ? p.avatar : 0; editInk = p ? p.ink : 0;
  $('#editTitle').textContent = p ? 'Edit profile' : store.data.profiles.length ? 'New profile' : 'Create your profile';
  $('#editName').value = p ? p.name : '';
  $('#btnEditDelete').classList.toggle('hidden', !p || store.data.profiles.length < 2);
  $('#btnEditCancel').classList.toggle('hidden', !store.data.profiles.length);
  renderPicks();
  showScreen('sEdit');
}
function renderPicks() {
  const lvl = editing ? levelInfo(editing.xp).level : 1;
  const ink = INKS[editInk].c;
  const ap = $('#avatarPick'); ap.innerHTML = '';
  AVATARS.forEach((a, i) => {
    const b = document.createElement('button'); b.className = 'pick' + (i === editAv ? ' sel' : '') + (a.lv > lvl ? ' locked' : '');
    b.dataset.lv = `Lv ${a.lv}`; b.title = a.name;
    const c = document.createElement('canvas'); paintAvatar(c, i, ink); b.appendChild(c);
    b.onclick = () => { if (a.lv > lvl) { toast(`${a.name} unlocks at level ${a.lv}`); return; } editAv = i; audio.play('click'); renderPicks(); };
    ap.appendChild(b);
  });
  const ip = $('#inkPick'); ip.innerHTML = '';
  INKS.forEach((k, i) => {
    const b = document.createElement('button'); b.className = 'pick swatch' + (i === editInk ? ' sel' : '') + (k.lv > lvl ? ' locked' : '');
    b.dataset.lv = `Lv ${k.lv}`; b.title = k.name; b.style.background = k.c;
    b.onclick = () => { if (k.lv > lvl) { toast(`${k.name} unlocks at level ${k.lv}`); return; } editInk = i; audio.play('click'); renderPicks(); };
    ip.appendChild(b);
  });
}
click('#btnEditSave', () => {
  const name = $('#editName').value.trim().slice(0, 14) || 'Doodler';
  if (editing) { editing.name = name; editing.avatar = editAv; editing.ink = editInk; }
  else { const p = newProfile(name, editAv, editInk); store.data.profiles.push(p); store.data.activeId = p.id; selProfile = p.id; }
  store.save();
  showScreen(store.data.profiles.length > 1 || editing ? 'sProfiles' : 'sMenu');
});
click('#btnEditCancel', () => showScreen('sProfiles'));
click('#btnEditDelete', () => {
  if (!editing || !confirm(`Delete ${editing.name}? Their XP and stats will be lost.`)) return;
  store.data.profiles = store.data.profiles.filter(p => p !== editing);
  if (store.data.activeId === editing.id) store.data.activeId = store.data.profiles[0]?.id;
  store.save(); showScreen('sProfiles');
});
function renderSettings() {
  const s = store.settings;
  const bind = (id, key, outId, fmt = (v) => v) => {
    const el = $(id);
    if (el.type === 'checkbox') el.checked = !!s[key]; else el.value = s[key];
    const out = outId && $(outId); if (out) out.textContent = fmt(s[key]);
    el.oninput = el.onchange = () => {
      s[key] = el.type === 'checkbox' ? el.checked : el.type === 'range' ? +el.value : el.value;
      if (out) out.textContent = fmt(s[key]);
      if (key === 'sfx') { audio.enabled = s.sfx; $('#bSound').classList.toggle('muted', !s.sfx); }
      if (key === 'quality') resize();
      if (key === 'fps') $('#fps').classList.toggle('hidden', !s.fps);
      applyHud();
      store.save();
    };
  };
  bind('#setSens', 'sens', '#setSensV', v => (+v).toFixed(2));
  bind('#setAssist', 'assist'); bind('#setSfx', 'sfx'); bind('#setVib', 'vib');
  bind('#setBots', 'bots', '#setBotsV'); bind('#setDiff', 'diff'); bind('#setQuality', 'quality');
  bind('#setFull', 'full'); bind('#setFps', 'fps');
  bind('#setHudScale', 'hudScale', '#setHudScaleV', v => `${Math.round(v * 100)}%`);
  bind('#setHudAlpha', 'hudAlpha', '#setHudAlphaV', v => `${Math.round(v * 100)}%`);
  bind('#setXh', 'xhStyle'); bind('#setXc', 'xhColor');
  bind('#setFeed', 'showFeed'); bind('#setTop3', 'showTop3'); bind('#setHint', 'showHint');
}

// ====================================================================== loadout screen
let loSlot = 0, loTab = 'ar', loSel = null;
const SLOT_NAMES = ['Primary', 'Secondary', 'Lethal', 'Tactical'];
const gunSvg = (g) => `<svg class="gsvg" viewBox="0 0 64 24">${GUN_SVG[g.cls]}</svg>`;
const eqSvg = (e) => `<svg class="esvg" viewBox="0 0 24 24">${EQ_SVG[e.id]}</svg>`;
function slotItem(lo, i) { return i < 2 ? GUN[lo.guns[i]] : EQUIP[i === 2 ? lo.lethal : lo.tactical]; }
function selectSlot(i) {
  const prof = store.active, lo = loadoutFor(prof);
  loSlot = i; const it = slotItem(lo, i); loSel = it.id;
  if (i < 2) loTab = it.cls;
}
function renderLoadout() {
  const prof = store.active; if (!prof) return;
  const lvl = levelInfo(prof.xp).level;
  const lo = prof.loadout = loadoutFor(prof);
  if (!loSel) selectSlot(loSlot);
  $('#loLevel').innerHTML = `<span class="lvl">LEVEL ${lvl}</span>`;
  $('#loNote').classList.toggle('hidden', S.mode !== 'playing');
  $('#loSlots').innerHTML = SLOT_NAMES.map((n, i) => {
    const it = slotItem(lo, i);
    return `<button class="doodle-box loSlot${i === loSlot ? ' sel' : ''}" data-slot="${i}"><small>${n}</small>${i < 2 ? gunSvg(it) : eqSvg(it)}<b>${esc(it.name)}</b>${i < 2 ? `<i>${CLASSES[it.cls].short}</i>` : ''}</button>`;
  }).join('');
  $$('#loSlots .loSlot').forEach(b => b.onclick = () => { audio.play('click'); selectSlot(+b.dataset.slot); renderLoadout(); });
  const isGun = loSlot < 2;
  $('#loTabs').innerHTML = isGun ? Object.entries(CLASSES).map(([k, c]) => `<button class="doodle-box loTab${k === loTab ? ' sel' : ''}" data-cls="${k}">${c.name}</button>`).join('') : `<div class="loTabHint">${loSlot === 2 ? 'Lethal: grenades &amp; bombs' : 'Tactical: utility'}</div>`;
  $$('#loTabs .loTab').forEach(b => b.onclick = () => { audio.play('click'); loTab = b.dataset.cls; const first = GUNS.find(g => g.cls === loTab && (lo.guns.includes(g.id))) || GUNS.find(g => g.cls === loTab); loSel = first.id; renderLoadout(); });
  const items = isGun ? GUNS.filter(g => g.cls === loTab) : loSlot === 2 ? LETHALS : TACTICALS;
  const mine = slotItem(lo, loSlot).id, other = isGun ? lo.guns[1 - loSlot] : null;
  $('#loList').innerHTML = items.map(it => {
    const locked = it.lv > lvl;
    const tag = it.id === mine ? '<em class="eq">EQUIPPED</em>' : it.id === other ? `<em class="ot">${SLOT_NAMES[1 - loSlot]}</em>` : '';
    return `<button class="doodle-box loItem${it.id === loSel ? ' sel' : ''}${locked ? ' locked' : ''}" data-id="${it.id}">${isGun ? gunSvg(it) : eqSvg(it)}<b>${esc(it.name)}</b>${locked ? `<span class="lk">&#x1F512; Lv ${it.lv}</span>` : tag}</button>`;
  }).join('');
  $$('#loList .loItem').forEach(b => b.onclick = () => { audio.play('click'); loSel = b.dataset.id; renderLoadout(); });
  const sel = GUN[loSel] || EQUIP[loSel];
  const locked = sel.lv > lvl, equipped = sel.id === mine;
  let body = `<div class="ldName">${esc(sel.name)}</div><div class="ldSub">${isGun ? CLASSES[sel.cls].name.replace(/s$/, '') : loSlot === 2 ? 'Lethal' : 'Tactical'} · unlocks at level ${sel.lv}</div><p class="ldDesc">${esc(sel.desc)}</p>`;
  if (isGun) {
    const r = gunRatings(sel);
    body += `<div class="ldStats">${Object.entries(r).map(([k, v]) => `<div class="st"><span>${k}</span><div class="sb"><i style="width:${v}%"></i></div></div>`).join('')}</div>
      <div class="ldNums"><span>Mag <b>${sel.mag}</b></span><span>${sel.pellets > 1 ? `Pellets <b>${sel.pellets}</b>` : `Dmg <b>${sel.dmg}</b>`}</span><span>RPM <b>${Math.round(60 / sel.rate)}</b></span><span>Kills <b>${prof.gunKills?.[sel.id] || 0}</b></span></div>`;
  } else body += `<div class="ldNums"><span>Carry <b>${sel.max}</b></span>${prof.gunKills?.[sel.id] ? `<span>Kills <b>${prof.gunKills[sel.id]}</b></span>` : ''}</div>`;
  body += `<button class="doodle-box ${locked || equipped ? '' : 'primary '}ldEquip" id="loEquip"${equipped ? ' disabled' : ''}>${locked ? `Locked &middot; reach level ${sel.lv}` : equipped ? `Equipped as ${SLOT_NAMES[loSlot]}` : sel.id === other ? `Swap into ${SLOT_NAMES[loSlot]}` : `Equip as ${SLOT_NAMES[loSlot]}`}</button>`;
  $('#loDetail').innerHTML = body;
  const eb = $('#loEquip');
  eb.onclick = () => {
    if (locked) { audio.play('empty'); toast(`${sel.name} unlocks at level ${sel.lv}`); return; }
    const L = prof.loadout;
    if (isGun) { if (sel.id === other) L.guns = [L.guns[1], L.guns[0]]; else L.guns[loSlot] = sel.id; }
    else if (loSlot === 2) L.lethal = sel.id; else L.tactical = sel.id;
    store.save(); audio.play('swap'); toast(`${sel.name} equipped`);
    renderLoadout();
  };
}

// ====================================================================== HUD customisation
const HUD_NAMES = { score: 'Score', top3: 'Top 3', pause: 'Settings button', feed: 'Kill feed', armor: 'Shield bar', hp: 'Health bar', joy: 'Joystick', jump: 'Jump', crouch: 'Crouch',
  weapons: 'Weapon cards', reload: 'Reload', lethal: 'Lethal', tactical: 'Tactical', fire: 'Fire', scope: 'Aim / scope', hint: 'Keyboard hint' };
function hudScaleOf(key) { const s = store.settings; return (s.hudScale || 1) * (s.hudLayout[key]?.s || 1); }
function applyHud() {
  const s = store.settings, hud = $('#hud');
  hud.style.setProperty('--ha', s.hudAlpha);
  $$('#hud [data-hud]').forEach(el => {
    const L = s.hudLayout[el.dataset.hud] || {};
    el.style.setProperty('--hx', `${((L.x || 0) * 100).toFixed(2)}vw`);
    el.style.setProperty('--hy', `${((L.y || 0) * 100).toFixed(2)}vh`);
    el.style.setProperty('--hs', hudScaleOf(el.dataset.hud).toFixed(3));
  });
  const xh = $('#xhair'); xh.dataset.style = s.xhStyle; xh.style.setProperty('--xc', s.xhColor);
  $('#feed').classList.toggle('hoff', !s.showFeed);
  $('#top3').classList.toggle('hoff', !s.showTop3);
  $('#desktopHint').classList.toggle('hoff', !s.showHint);
}
let heSel = null, heDrag = null, heFrom = 'sSettings', heDemo = false;
function enterHudEdit() {
  S.editing = true; heFrom = 'sSettings';
  showScreen(null);
  document.body.classList.add('hudedit');
  const hud = $('#hud'); hud.classList.remove('hidden'); hud.classList.add('editing');
  $('#board').classList.add('hidden'); $('#deathScreen').classList.add('hidden');
  if (!G.player || S.mode !== 'playing') fillHudDemo();
  heSelect(null); applyHud();
}
function exitHudEdit() {
  S.editing = false; heSelect(null);
  document.body.classList.remove('hudedit');
  const hud = $('#hud'); hud.classList.remove('editing');
  if (S.mode !== 'playing') { hud.classList.add('hidden'); clearHudDemo(); }
  else if (G.player && !G.player.alive) $('#deathScreen').classList.remove('hidden');
  store.save(); showScreen(heFrom);
}
function fillHudDemo() {
  if (heDemo) return; heDemo = true;
  const prof = store.active, lo = loadoutFor(prof);
  if (!$('#top3').children.length) {
    $('#top3').innerHTML = ['Scribbles', 'You', 'Inky'].map((n, i) => `<div class="t3 demo${i === 1 ? ' me' : ''}"><canvas data-av="${i * 3}"></canvas><div class="n">${i + 1}. ${n} <b>${9 - i * 2}</b></div></div>`).join('');
    $$('#top3 canvas').forEach(c => paintAvatar(c, +c.dataset.av, INKS[(+c.dataset.av) % INKS.length].c));
  }
  if (!$('#feed').children.length) $('#feed').innerHTML = '<div class="fe demo"><b>Inky</b> <span class="wpn">&#x2192; AK117</span> <b>Doodlebug</b></div>';
  setWeaponCards(lo.guns.map(id => GUN[id])); setEquipButtons(lo.lethal, lo.tactical);
}
function clearHudDemo() {
  if (!heDemo) return; heDemo = false;
  $$('#top3 .demo, #feed .demo').forEach(e => e.remove());
}
function heSelect(key) {
  heSel = key;
  $$('#hud [data-hud]').forEach(el => el.classList.toggle('heOn', el.dataset.hud === key));
  $('#heName').textContent = key ? HUD_NAMES[key] : 'Tap a control to resize it';
  $('#heSize').textContent = key ? `${Math.round((store.settings.hudLayout[key]?.s || 1) * 100)}%` : '';
  $$('#heSmaller,#heBigger,#heResetOne').forEach(b => (b.disabled = !key));
}
function heLayout(key) { const L = store.settings.hudLayout; return (L[key] = L[key] || { x: 0, y: 0, s: 1 }); }
$('#hud').addEventListener('pointerdown', (e) => {
  if (!S.editing) return;
  const el = e.target instanceof Element ? e.target.closest('[data-hud]') : null;
  if (!el) return;
  e.preventDefault(); e.stopPropagation();
  const key = el.dataset.hud, L = heLayout(key);
  heSelect(key);
  heDrag = { key, el, id: e.pointerId, sx: e.clientX, sy: e.clientY, lx: L.x, ly: L.y };
  try { el.setPointerCapture(e.pointerId); } catch {}
}, true);
addEventListener('pointermove', (e) => {
  if (!heDrag || e.pointerId !== heDrag.id) return;
  const L = heLayout(heDrag.key);
  L.x = clamp(heDrag.lx + (e.clientX - heDrag.sx) / innerWidth, -0.95, 0.95);
  L.y = clamp(heDrag.ly + (e.clientY - heDrag.sy) / innerHeight, -0.95, 0.95);
  // keep the control's centre on screen
  const r = heDrag.el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  if (cx < 0) L.x += -cx / innerWidth; if (cx > innerWidth) L.x -= (cx - innerWidth) / innerWidth;
  if (cy < 0) L.y += -cy / innerHeight; if (cy > innerHeight) L.y -= (cy - innerHeight) / innerHeight;
  applyHud();
});
const heEnd = (e) => { if (heDrag && e.pointerId === heDrag.id) { heDrag = null; store.save(); } };
addEventListener('pointerup', heEnd); addEventListener('pointercancel', heEnd);
function heResize(d) { if (!heSel) return; const L = heLayout(heSel); L.s = clamp(Math.round((L.s + d) * 20) / 20, 0.5, 1.8); applyHud(); heSelect(heSel); store.save(); }
const heBtn = (sel, fn) => $(sel).addEventListener('click', (e) => { e.stopPropagation(); audio.play('click'); fn(); });
heBtn('#heSmaller', () => heResize(-0.1));
heBtn('#heBigger', () => heResize(0.1));
heBtn('#heResetOne', () => { if (heSel) { delete store.settings.hudLayout[heSel]; applyHud(); heSelect(heSel); store.save(); } });
heBtn('#heResetAll', () => { if (confirm('Put every control back where it started?')) { store.settings.hudLayout = {}; applyHud(); heSelect(null); store.save(); } });
heBtn('#heDone', () => exitHudEdit());
let toastT = 0;
function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), 1600); }

function ensureProfile() {
  if (!store.data.profiles.length) openEdit(null);
  else { if (!store.active) store.data.activeId = store.data.profiles[0].id; showScreen('sMenu'); }
}

// ====================================================================== boot
applyHud();
document.fonts?.ready.then(() => {}).catch(() => {});
Promise.race([document.fonts ? document.fonts.load('40px Marker') : Promise.resolve(), new Promise(r => setTimeout(r, 1500))]).finally(() => {
  $('#loading').remove();
  ensureProfile();
});
requestAnimationFrame(frame);
// quick sanity for tests
window.__debug = { startMatch, G, S, store, GUN, EQUIP, playerThrow, applyHud, kill, damage, endMatch, levelInfo, MAX_LEVEL };
