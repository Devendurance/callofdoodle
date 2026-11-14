// NPC opponents: doodle visuals + free-for-all AI.
import * as THREE from 'three';
import { shared, moveBody, lineClear, findPath, randomWalkable, walkable, canvasTex } from './world.js';
import { avatarCanvas } from './data.js';

export const BOT_NAMES = ['Scribbles', 'Inky', 'Smudge', 'Doodlebug', 'Graphite', 'Eraserhead', 'Crayonce',
  'Squiggle', 'Sketchy', 'Pencilvester', 'Blot', 'Marginal', 'Scrawl', 'Biro', 'Highlighta'];
export const BOT_INKS = ['#d8352c', '#2f5fd0', '#2fa858', '#8a3fc8', '#f07a1a', '#e85aa8', '#d4a017', '#1aa6a6', '#7a5230', '#5560e0', '#c23b7a'];

const DIFF = {
  easy: { acc: 0.2, react: 0.8, turn: 4.0, speed: 0.85 },
  normal: { acc: 0.3, react: 0.5, turn: 6.0, speed: 1.0 },
  hard: { acc: 0.42, react: 0.3, turn: 9.0, speed: 1.1 },
};

// -------------------------------------------------------------- character materials
export function charMaterial(color) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) }, uInk: { value: new THREE.Color('#1c1c26') }, uPaper: { value: new THREE.Color('#f7f2e4') },
      uFlash: { value: 0 }, uFogNear: shared.uFogNear, uFogFar: shared.uFogFar, uPx: { value: Math.min(devicePixelRatio, 2) },
    },
    vertexShader: /* glsl */`varying vec3 vN; varying float vDepth;
      void main(){ vN = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.); vDepth=-mv.z; gl_Position=projectionMatrix*mv; }`,
    fragmentShader: /* glsl */`uniform vec3 uColor, uInk, uPaper; uniform float uFlash, uFogNear, uFogFar, uPx; varying vec3 vN; varying float vDepth;
      void main(){
        float l = dot(normalize(vN), normalize(vec3(.35,.7,.6)))*.5+.5;
        float c = (gl_FragCoord.x + gl_FragCoord.y)/(6.0*uPx);
        float hl = abs(fract(c)-.5);
        float hatch = (1.-smoothstep(.12,.2,hl)) * smoothstep(.42,.55,1.-l);
        vec3 col = uColor * mix(1., .86, 1.-l);
        col = mix(col, uInk, hatch*.55);
        col = mix(col, vec3(1.,.3,.25), uFlash);
        col = mix(col, uPaper, smoothstep(uFogNear, uFogFar, vDepth));
        gl_FragColor = vec4(col,1.);
      }`,
  });
}
const outlineMatCache = {};
export function outlineMaterial(thick = 0.03) {
  if (outlineMatCache[thick]) return outlineMatCache[thick];
  return (outlineMatCache[thick] = new THREE.ShaderMaterial({
    uniforms: { uT: { value: thick }, uFogNear: shared.uFogNear, uFogFar: shared.uFogFar },
    vertexShader: /* glsl */`uniform float uT; varying float vDepth;
      void main(){ vec4 mv = modelViewMatrix*vec4(position + normal*uT, 1.); vDepth=-mv.z; gl_Position = projectionMatrix*mv; }`,
    fragmentShader: /* glsl */`uniform float uFogNear, uFogFar; varying float vDepth;
      void main(){ gl_FragColor = vec4(mix(vec3(.11,.11,.15), vec3(.97,.95,.89), smoothstep(uFogNear,uFogFar,vDepth)), 1.); }`,
    side: THREE.BackSide,
  }));
}
function outlined(geo, mat, thick = 0.03) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(geo, mat));
  g.add(new THREE.Mesh(geo, outlineMaterial(thick)));
  return g;
}
const pastel = (hex, k = 0.55) => new THREE.Color(hex).lerp(new THREE.Color('#fbf8ef'), k);

const GEO = {
  torso: new THREE.CapsuleGeometry(0.3, 0.35, 4, 12),
  leg: new THREE.CapsuleGeometry(0.1, 0.4, 3, 8),
  arm: new THREE.CapsuleGeometry(0.075, 0.34, 3, 8),
  gun: (() => { const g = new THREE.BoxGeometry(0.09, 0.11, 0.62); return g; })(),
  hand: new THREE.SphereGeometry(0.08, 8, 6),
};
const backTexCache = new Map();
function backTex(ink) {
  if (backTexCache.has(ink)) return backTexCache.get(ink);
  const t = canvasTex((ctx, s) => {
    ctx.strokeStyle = '#1c1c26'; ctx.lineWidth = s * 0.04; ctx.fillStyle = '#fbf8ef';
    ctx.beginPath(); ctx.arc(s / 2, s * 0.54, s * 0.34, 0, 7); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = ink; ctx.lineWidth = s * 0.025;
    ctx.beginPath();
    for (let i = 0; i < 9; i++) { const x = s * (0.3 + i * 0.05); ctx.moveTo(x, s * 0.26); ctx.quadraticCurveTo(x + s * 0.06, s * 0.36, x - s * 0.02, s * 0.46); }
    ctx.stroke();
  }, 128);
  backTexCache.set(ink, t); return t;
}
const faceTexCache = new Map();
function faceTex(avatar, ink) {
  const k = avatar + ink;
  if (!faceTexCache.has(k)) { const t = new THREE.CanvasTexture(avatarCanvas(avatar, ink, 128)); faceTexCache.set(k, t); }
  return faceTexCache.get(k);
}
export function textSprite(text, color = '#1c1c26', h = 0.24) {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  const fs = 44; ctx.font = `${fs}px Hand, sans-serif`;
  const w = Math.ceil(ctx.measureText(text).width) + 24;
  c.width = w; c.height = 64;
  ctx.font = `${fs}px Hand, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 8; ctx.strokeStyle = '#f7f2e4'; ctx.lineJoin = 'round'; ctx.strokeText(text, w / 2, 34);
  ctx.fillStyle = color; ctx.fillText(text, w / 2, 34);
  const t = new THREE.CanvasTexture(c);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthWrite: false, transparent: true }));
  s.scale.set(h * w / 64, h, 1);
  return s;
}

// -------------------------------------------------------------- fighter base data
export function makeFighter(o) {
  return Object.assign({
    id: 0, name: '?', isPlayer: false, avatar: 0, ink: '#2a2a35',
    score: 0, kills: 0, deaths: 0, headshots: 0, streak: 0, bestStreak: 0,
    hp: 100, armor: 50, alive: false, respawnAt: 0, protectUntil: 0, lastAttacker: null, lastHurtAt: -9,
    body: { x: 0, y: 0, z: 0, vy: 0, r: 0.4, h: 1.75, onGround: true },
    yaw: 0, crouch: false, vel: { x: 0, z: 0 },
  }, o);
}

let nextId = 1;
export class Bot {
  constructor(G, { name, avatar, ink }, diffName) {
    this.G = G;
    Object.assign(this, makeFighter({ id: nextId++, name, avatar, ink }));
    const d = DIFF[diffName] || DIFF.normal;
    const m = 0.8 + Math.random() * 0.4;
    this.skill = { acc: d.acc * m, react: d.react / m, turn: d.turn * (0.85 + Math.random() * 0.3), speed: d.speed * (0.92 + Math.random() * 0.16) };
    this.weapon = Math.random() < 0.25 ? 'sniper' : 'rifle';
    this.prefDist = this.weapon === 'sniper' ? 22 : 10 + Math.random() * 6;
    this.target = null; this.visible = false; this.lastSeen = null; this.lastSeenAt = -9;
    this.reaction = 0; this.track = 0; this.cool = 0; this.burst = 0;
    this.scanT = Math.random() * 0.2; this.path = null; this.goalT = 0; this.strafeT = 0; this.strafeDir = 1;
    this.stuckT = 0; this.phase = Math.random() * 6; this.flashT = 0; this.mflashT = 0; this.crouchT = 0;
    this.build();
  }

  build() {
    const g = this.group = new THREE.Group();
    this.mat = charMaterial(pastel(this.ink, 0.45));
    const limbMat = this.limbMat = charMaterial(pastel(this.ink, 0.2));
    const torso = outlined(GEO.torso, this.mat, 0.03); torso.position.y = 0.98; g.add(torso); this.torso = torso;
    // belly button doodle / number
    this.legs = [];
    for (const s of [-1, 1]) {
      const hip = new THREE.Group(); hip.position.set(s * 0.14, 0.62, 0);
      const leg = outlined(GEO.leg, limbMat, 0.025); leg.position.y = -0.3; hip.add(leg);
      g.add(hip); this.legs.push(hip);
    }
    const gunMat = charMaterial('#55555f');
    const gun = new THREE.Group();
    const gm = new THREE.Mesh(GEO.gun, gunMat); gun.add(gm);
    const go = new THREE.Mesh(GEO.gun, outlineMaterial(0.02)); go.scale.set(1.25, 1.2, 1.06); gun.add(go);
    if (this.weapon === 'sniper') { const sc = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.25), gunMat); sc.position.set(0, 0.09, -0.02); gun.add(sc); gm.scale.z = 1.35; go.scale.z = 1.4; }
    gun.position.set(0.16, 1.08, -0.38); g.add(gun); this.gun = gun;
    for (const [x, z, rx] of [[0.25, -0.12, -1.25], [-0.12, -0.25, -1.35]]) {
      const arm = outlined(GEO.arm, limbMat, 0.022);
      arm.position.set(x, 1.18, z); arm.rotation.x = rx; arm.rotation.z = x > 0 ? 0.15 : -0.5; g.add(arm);
    }
    // muzzle flash
    this.mflash = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.G.tex.flash, depthWrite: false, transparent: true }));
    this.mflash.scale.set(0.6, 0.6, 1); this.mflash.position.set(0.16, 1.1, this.weapon === 'sniper' ? -1.15 : -0.85); this.mflash.visible = false; g.add(this.mflash);
    // head sprite (separate so it can billboard + offset toward camera)
    this.faceT = faceTex(this.avatar, this.ink); this.backT = backTex(this.ink);
    this.head = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.faceT, transparent: true, alphaTest: 0.3 }));
    this.head.scale.set(0.72, 0.72, 1);
    this.tag = textSprite(this.name, this.ink, 0.26);
    this.G.scene.add(g); this.G.scene.add(this.head); this.G.scene.add(this.tag);
    this.setVisible(false);
  }
  setVisible(v) { this.group.visible = v; this.head.visible = v; this.tag.visible = v; }
  dispose() { this.G.scene.remove(this.group); this.G.scene.remove(this.head); this.G.scene.remove(this.tag); }

  spawn(p) {
    const b = this.body; b.x = p.x; b.z = p.z; b.y = 0; b.vy = 0;
    this.hp = 100; this.armor = 25 + Math.round(Math.random() * 25); this.alive = true; this.streak = 0;
    this.protectUntil = this.G.time + 1.5;
    this.yaw = Math.atan2(b.x, b.z); // face roughly toward centre
    this.target = null; this.visible = false; this.path = null; this.goalT = 0; this.lastAttacker = null;
    this.setVisible(true);
  }
  die() { this.alive = false; this.setVisible(false); this.target = null; }

  eye() { return this.body.y + (this.crouch ? 1.15 : 1.55); }

  // ------------------------------------------------ AI
  perceive() {
    const G = this.G, b = this.body, ey = this.eye();
    let best = null, bestScore = 1e9;
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    for (const o of G.fighters) {
      if (o === this || !o.alive) continue;
      const dx = o.body.x - b.x, dz = o.body.z - b.z, dist = Math.hypot(dx, dz);
      if (dist > 48) continue;
      const cos = (dx * fx + dz * fz) / (dist || 1);
      const aware = cos > 0.3 || dist < 7 || o === this.lastAttacker && G.time - this.lastHurtAt < 3;
      if (!aware) continue;
      const oy = o.body.y + (o.crouch ? 1.0 : 1.4);
      if (!lineClear(b.x, ey, b.z, o.body.x, oy, o.body.z)) continue;
      let s = dist * (o.isPlayer ? 0.85 : 1);
      if (o === this.target) s *= 0.7;
      if (o === this.lastAttacker && G.time - this.lastHurtAt < 3) s *= 0.5;
      if (s < bestScore) { bestScore = s; best = o; }
    }
    if (best) {
      if (best !== this.target || !this.visible) { this.reaction = this.skill.react * (0.7 + Math.random() * 0.6); this.track = 0; }
      this.target = best; this.visible = true;
      this.lastSeen = { x: best.body.x, z: best.body.z }; this.lastSeenAt = G.time;
    } else {
      this.visible = false;
      if (this.target && (!this.target.alive || G.time - this.lastSeenAt > 4)) this.target = null;
    }
  }

  pickGoal() {
    const G = this.G;
    let goal = null;
    if (this.hp < 45) {
      let bd = 1e9;
      for (const p of G.pickups) if (p.active && (p.type === 'health' || p.type === 'armor')) {
        const d = Math.hypot(p.x - this.body.x, p.z - this.body.z); if (d < bd) { bd = d; goal = { x: p.x, z: p.z }; }
      }
    }
    if (!goal && this.lastSeen && G.time - this.lastSeenAt < 6) goal = this.lastSeen;
    if (!goal && Math.random() < 0.45) {
      const others = G.fighters.filter(o => o !== this && o.alive);
      if (others.length) { const o = others[(Math.random() * others.length) | 0]; const jx = o.body.x + (Math.random() - 0.5) * 10, jz = o.body.z + (Math.random() - 0.5) * 10; if (walkable(jx, jz)) goal = { x: jx, z: jz }; }
    }
    if (!goal) goal = randomWalkable();
    this.path = findPath(this.body.x, this.body.z, goal.x, goal.z);
    this.goalT = 5 + Math.random() * 5;
  }

  hurt(attacker) {
    this.lastAttacker = attacker; this.lastHurtAt = this.G.time; this.flashT = 0.12;
    if (!this.visible && attacker && attacker.alive) {
      // turn toward the threat and remember where it was
      this.lastSeen = { x: attacker.body.x, z: attacker.body.z }; this.lastSeenAt = this.G.time;
      this.target = attacker; this.scanT = 0;
    }
  }

  update(dt) {
    if (!this.alive) return;
    const G = this.G, b = this.body;
    this.scanT -= dt;
    if (this.scanT <= 0) { this.scanT = 0.12 + Math.random() * 0.1; this.perceive(); }

    let mx = 0, mz = 0, faceYaw = null, speed = 4.4 * this.skill.speed;
    const tgt = this.target;
    if (tgt && tgt.alive && this.visible) {
      const dx = tgt.body.x - b.x, dz = tgt.body.z - b.z, dist = Math.hypot(dx, dz);
      faceYaw = Math.atan2(-dx, -dz);
      // strafe & keep distance
      this.strafeT -= dt;
      if (this.strafeT <= 0) { this.strafeT = 0.5 + Math.random() * 1.1; this.strafeDir = Math.random() < 0.5 ? -1 : 1; if (Math.random() < 0.15 && b.onGround) b.vy = 6.5; this.crouchT = Math.random() < 0.18 ? 0.8 + Math.random() : 0; }
      const ux = dx / (dist || 1), uz = dz / (dist || 1);
      const fwd = dist > this.prefDist + 4 ? 1 : dist < this.prefDist - 4 ? -0.8 : 0;
      mx = ux * fwd + -uz * this.strafeDir * 0.85; mz = uz * fwd + ux * this.strafeDir * 0.85;
      speed *= 0.8;
      this.reaction -= dt; this.track = Math.min(1, this.track + dt * 1.2);
      const ad = Math.abs(angDiff(this.yaw, faceYaw));
      this.cool -= dt;
      if (this.reaction <= 0 && ad < 0.25 && this.cool <= 0) this.shoot(tgt, dist);
      this.path = null; this.goalT = 0;
    } else {
      this.crouchT = 0;
      this.goalT -= dt;
      if (!this.path || !this.path.length || this.goalT <= 0) this.pickGoal();
      if (this.path && this.path.length) {
        const wp = this.path[0];
        const dx = wp.x - b.x, dz = wp.z - b.z, d = Math.hypot(dx, dz);
        if (d < 0.6) this.path.shift();
        else { mx = dx / d; mz = dz / d; faceYaw = Math.atan2(-mx, -mz); }
      }
      if (tgt && !this.visible && this.lastSeen) faceYaw = Math.atan2(-(this.lastSeen.x - b.x), -(this.lastSeen.z - b.z));
    }
    if (this.crouchT > 0) { this.crouchT -= dt; this.crouch = true; speed *= 0.5; } else this.crouch = false;
    if (faceYaw !== null) this.yaw += clamp(angDiff(this.yaw, faceYaw), -this.skill.turn * dt, this.skill.turn * dt);

    // move
    const ml = Math.hypot(mx, mz);
    if (ml > 1) { mx /= ml; mz /= ml; }
    const tx = mx * speed, tz = mz * speed;
    const k = Math.min(1, dt * 10);
    this.vel.x += (tx - this.vel.x) * k; this.vel.z += (tz - this.vel.z) * k;
    const ox = b.x, oz = b.z;
    b.h = this.crouch ? 1.3 : 1.75;
    moveBody(b, this.vel.x * dt, this.vel.z * dt, dt);
    const moved = Math.hypot(b.x - ox, b.z - oz), want = Math.hypot(this.vel.x, this.vel.z) * dt;
    if (want > 0.02 && moved < want * 0.35) { this.stuckT += dt; if (b.onGround && this.stuckT > 0.12) { b.vy = 7; } if (this.stuckT > 1.2) { this.path = null; this.stuckT = 0; this.strafeDir *= -1; } }
    else this.stuckT = 0;

    // visuals
    const sp = Math.hypot(this.vel.x, this.vel.z);
    this.phase += dt * sp * 2.4;
    const sw = Math.sin(this.phase) * Math.min(1, sp / 3) * 0.7;
    this.legs[0].rotation.x = sw; this.legs[1].rotation.x = -sw;
    this.group.position.set(b.x, b.y + (b.onGround ? Math.abs(Math.sin(this.phase)) * 0.05 : 0), b.z);
    this.group.rotation.y = this.yaw;
    const cs = this.crouch ? 0.72 : 1;
    this.group.scale.y += (cs - this.group.scale.y) * Math.min(1, dt * 12);
    if (this.flashT > 0) { this.flashT -= dt; this.mat.uniforms.uFlash.value = 0.7; this.limbMat.uniforms.uFlash.value = 0.7; }
    else { this.mat.uniforms.uFlash.value = 0; this.limbMat.uniforms.uFlash.value = 0; }
    if (this.mflashT > 0) { this.mflashT -= dt; this.mflash.visible = true; this.mflash.material.rotation = Math.random() * 6; } else this.mflash.visible = false;
    const prot = G.time < this.protectUntil;
    this.group.visible = !prot || ((G.time * 10) | 0) % 2 === 0;
  }

  // called every frame after camera moves
  billboard(cam) {
    if (!this.alive) return;
    const b = this.body;
    const hy = b.y + this.group.scale.y * 1.6;
    const cx = cam.position.x - b.x, cz = cam.position.z - b.z, d = Math.hypot(cx, cz) || 1;
    this.head.position.set(b.x + cx / d * 0.28, hy, b.z + cz / d * 0.28);
    const facing = (-Math.sin(this.yaw) * cx + -Math.cos(this.yaw) * cz) / d;
    const want = facing > -0.2 ? this.faceT : this.backT;
    if (this.head.material.map !== want) { this.head.material.map = want; this.head.material.needsUpdate = true; }
    this.tag.position.set(b.x, hy + 0.55, b.z);
    this.tag.visible = this.group.visible && d < 26;
    this.head.visible = this.group.visible || G_prot(this);
  }

  shoot(tgt, dist) {
    const G = this.G, b = this.body;
    const sniper = this.weapon === 'sniper';
    if (sniper) this.cool = 1.5 + Math.random() * 0.8;
    else {
      if (this.burst <= 0) this.burst = 3 + ((Math.random() * 4) | 0);
      this.burst--;
      this.cool = this.burst <= 0 ? 0.35 + Math.random() * 0.5 : 0.11 + Math.random() * 0.03;
    }
    this.mflashT = 0.05;
    // hit chance
    let p = this.skill.acc * (sniper ? 1.6 : 1);
    p *= sniper ? clamp(1.15 - dist / 90, 0.3, 1) : clamp(1.2 - dist / 38, 0.15, 1.1);
    const tv = Math.hypot(tgt.vel.x, tgt.vel.z);
    if (tv > 1) p *= 0.78;
    if (!tgt.body.onGround) p *= 0.75;
    if (tgt.crouch) p *= 0.85;
    p *= 0.45 + 0.55 * this.track;
    if (tgt.isPlayer) p *= G.playerHitMul;
    const hit = Math.random() < p;
    const head = hit && Math.random() < (sniper ? 0.3 : 0.12);
    const from = new THREE.Vector3(b.x, this.eye() - 0.4, b.z).addScaledVector(new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)), sniper ? 1.1 : 0.8);
    from.x += Math.cos(this.yaw) * 0.16; from.z -= Math.sin(this.yaw) * 0.16;
    const to = new THREE.Vector3(tgt.body.x, tgt.body.y + (head ? 1.55 : 1.0), tgt.body.z);
    if (!hit) { to.x += (Math.random() - 0.5) * 2.2; to.y += (Math.random() - 0.3) * 1.4; to.z += (Math.random() - 0.5) * 2.2; }
    G.botShot(this, from, to, hit ? tgt : null, sniper ? (head ? 120 : 70) : (head ? 22 : 11), head, sniper);
  }

  // hitscan test vs this bot's body (cylinder) and head (sphere)
  hitTest(o, d, assist) {
    if (!this.alive) return null;
    const b = this.body, sc = this.group.scale.y;
    const hr = 0.3 + assist * 0.06, br = 0.36 + assist * 0.1;
    const hc = { x: b.x, y: b.y + 1.6 * sc, z: b.z };
    let best = null;
    // head sphere
    const lx = o.x - hc.x, ly = o.y - hc.y, lz = o.z - hc.z;
    const bq = lx * d.x + ly * d.y + lz * d.z, cq = lx * lx + ly * ly + lz * lz - hr * hr, disc = bq * bq - cq;
    if (disc >= 0) { const t = -bq - Math.sqrt(disc); if (t > 0) best = { t, head: true }; }
    // body cylinder
    const y0 = b.y, y1 = b.y + 1.32 * sc;
    const px = o.x - b.x, pz = o.z - b.z;
    const a = d.x * d.x + d.z * d.z;
    if (a > 1e-8) {
      const bb = px * d.x + pz * d.z, cc = px * px + pz * pz - br * br, dd = bb * bb - a * cc;
      if (dd >= 0) {
        const s = Math.sqrt(dd), t0 = (-bb - s) / a, t1 = (-bb + s) / a;
        let t = null;
        if (t0 > 0) { const y = o.y + d.y * t0; if (y >= y0 && y <= y1) t = t0; }
        if (t === null && Math.abs(d.y) > 1e-6) { // through the top cap
          const tc = (y1 - o.y) / d.y; if (tc > 0 && tc >= t0 && tc <= t1) t = tc;
        }
        if (t !== null && (!best || t < best.t)) best = { t, head: false };
      }
    }
    return best;
  }
}
function G_prot() { return false; }
export function angDiff(a, b) { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; }
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
