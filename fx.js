// Doodle effects: canvas textures, tracers, splats, explosions, ink clouds, pickups.
import * as THREE from 'three';
import { canvasTex, inkClouds, rayWorld, boxes } from './world.js';

const INKC = '#1c1c26';
function scribbleBlob(ctx, cx, cy, r, n, rnd, fill) {
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = i / n * Math.PI * 2, rr = r * (0.75 + rnd() * 0.45) * (i % 2 ? 0.7 : 1);
    const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  ctx.stroke();
}
function makeRnd(s) { return () => ((s = (s * 16807) % 2147483647) / 2147483647); }

export function makeTextures() {
  const T = {};
  T.flash = canvasTex((ctx, s) => {
    const r = makeRnd(3); ctx.lineWidth = 5; ctx.strokeStyle = INKC; ctx.lineJoin = 'round';
    scribbleBlob(ctx, s / 2, s / 2, s * 0.42, 14, r, '#ffd84a');
    ctx.fillStyle = '#fff7d0'; ctx.beginPath(); ctx.arc(s / 2, s / 2, s * 0.13, 0, 7); ctx.fill();
  }, 128);
  T.splat = canvasTex((ctx, s) => {
    const r = makeRnd(11); ctx.fillStyle = INKC;
    ctx.beginPath(); ctx.arc(s / 2, s / 2, s * 0.16, 0, 7); ctx.fill();
    for (let i = 0; i < 9; i++) { const a = r() * 7, d = s * (0.18 + r() * 0.22); ctx.beginPath(); ctx.arc(s / 2 + Math.cos(a) * d, s / 2 + Math.sin(a) * d, s * (0.02 + r() * 0.05), 0, 7); ctx.fill(); }
    ctx.strokeStyle = INKC; ctx.lineWidth = 4;
    for (let i = 0; i < 5; i++) { const a = r() * 7; ctx.beginPath(); ctx.moveTo(s / 2, s / 2); ctx.lineTo(s / 2 + Math.cos(a) * s * 0.4, s / 2 + Math.sin(a) * s * 0.4); ctx.stroke(); }
  }, 64);
  T.hit = canvasTex((ctx, s) => {
    const r = makeRnd(5); ctx.lineWidth = 4; ctx.strokeStyle = INKC;
    scribbleBlob(ctx, s / 2, s / 2, s * 0.42, 16, r, '#ff6a5c');
  }, 64);
  T.boom = canvasTex((ctx, s) => {
    const r = makeRnd(7); ctx.lineWidth = 7; ctx.strokeStyle = INKC; ctx.lineJoin = 'round';
    scribbleBlob(ctx, s / 2, s / 2, s * 0.46, 20, r, '#ffb43a');
    scribbleBlob(ctx, s / 2, s / 2, s * 0.3, 14, r, '#ffe36a');
    ctx.font = `${s * 0.22}px Marker, Impact, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 8; ctx.strokeText('BOOM!', s / 2, s / 2); ctx.fillStyle = '#fff'; ctx.fillText('BOOM!', s / 2, s / 2);
  }, 256);
  T.poof = canvasTex((ctx, s) => {
    ctx.lineWidth = 5; ctx.strokeStyle = INKC; ctx.fillStyle = '#fffdf6';
    const pts = [[0.3, 0.55, 0.17], [0.5, 0.4, 0.22], [0.7, 0.55, 0.17], [0.5, 0.66, 0.18]];
    ctx.beginPath(); for (const [x, y, r] of pts) { ctx.moveTo(x * s + r * s, y * s); ctx.arc(x * s, y * s, r * s, 0, 7); } ctx.fill();
    for (const [x, y, r] of pts) { ctx.beginPath(); ctx.arc(x * s, y * s, r * s, 0, 7); ctx.stroke(); }
    ctx.fillStyle = '#fffdf6'; ctx.beginPath(); for (const [x, y, r] of pts) { ctx.moveTo(x * s + r * s - 5, y * s); ctx.arc(x * s, y * s, r * s - 5, 0, 7); } ctx.fill();
    ctx.font = `${s * 0.16}px Marker, sans-serif`; ctx.textAlign = 'center'; ctx.fillStyle = INKC; ctx.fillText('x_x', s / 2, s * 0.56);
  }, 128);
  T.ink = canvasTex((ctx, s) => {
    const r = makeRnd(19); ctx.strokeStyle = 'rgba(28,28,38,0.9)'; ctx.lineWidth = 3;
    ctx.fillStyle = 'rgba(40,40,58,0.82)'; ctx.beginPath(); ctx.arc(s / 2, s / 2, s * 0.4, 0, 7); ctx.fill();
    for (let i = 0; i < 90; i++) { const a = r() * 7, d = r() * s * 0.42; const x = s / 2 + Math.cos(a) * d, y = s / 2 + Math.sin(a) * d;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + (r() - 0.5) * 40, y + (r() - 0.5) * 40, x + (r() - 0.5) * 30, y + (r() - 0.5) * 30); ctx.stroke(); }
  }, 128);
  T.ring = canvasTex((ctx, s) => {
    ctx.strokeStyle = INKC; ctx.lineWidth = 5; ctx.setLineDash([14, 10]);
    ctx.beginPath(); ctx.arc(s / 2, s / 2, s * 0.42, 0, 7); ctx.stroke();
  }, 128);
  const icon = (draw) => canvasTex((ctx, s) => {
    ctx.lineWidth = 6; ctx.strokeStyle = INKC; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.fillStyle = '#fffdf6'; ctx.beginPath(); ctx.arc(s / 2, s / 2, s * 0.44, 0, 7); ctx.fill(); ctx.stroke();
    draw(ctx, s);
  }, 128);
  T.pick = {
    health: icon((ctx, s) => { ctx.fillStyle = '#e0473f'; ctx.beginPath(); const a = s * 0.12, b = s * 0.3; ctx.rect(s / 2 - a, s / 2 - b, a * 2, b * 2); ctx.rect(s / 2 - b, s / 2 - a, b * 2, a * 2); ctx.fill(); ctx.strokeRect(s / 2 - a, s / 2 - b, a * 2, b * 2); ctx.strokeRect(s / 2 - b, s / 2 - a, b * 2, a * 2); ctx.fillRect(s / 2 - a + 3, s / 2 - a + 3, a * 2 - 6, a * 2 - 6); }),
    armor: icon((ctx, s) => { ctx.fillStyle = '#3d7fe0'; ctx.beginPath(); ctx.moveTo(s / 2, s * 0.18); ctx.lineTo(s * 0.76, s * 0.28); ctx.quadraticCurveTo(s * 0.76, s * 0.66, s / 2, s * 0.84); ctx.quadraticCurveTo(s * 0.24, s * 0.66, s * 0.24, s * 0.28); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(s / 2, s * 0.3); ctx.lineTo(s / 2, s * 0.72); ctx.stroke(); }),
    ammo: icon((ctx, s) => { ctx.fillStyle = '#f2b632'; for (const x of [0.32, 0.5, 0.68]) { ctx.beginPath(); ctx.moveTo(s * x - 9, s * 0.74); ctx.lineTo(s * x - 9, s * 0.42); ctx.quadraticCurveTo(s * x, s * 0.18, s * x + 9, s * 0.42); ctx.lineTo(s * x + 9, s * 0.74); ctx.closePath(); ctx.fill(); ctx.stroke(); } }),
    nade: icon((ctx, s) => { ctx.fillStyle = '#6fa04a'; ctx.beginPath(); ctx.ellipse(s / 2, s * 0.58, s * 0.2, s * 0.23, 0, 0, 7); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#999'; ctx.fillRect(s * 0.42, s * 0.26, s * 0.16, s * 0.1); ctx.strokeRect(s * 0.42, s * 0.26, s * 0.16, s * 0.1); ctx.beginPath(); ctx.arc(s * 0.66, s * 0.28, s * 0.07, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.moveTo(s * 0.34, s * 0.55); ctx.lineTo(s * 0.66, s * 0.55); ctx.stroke(); }),
  };
  return T;
}

// -------------------------------------------------------------- effect system
export class FX {
  constructor(scene, tex) {
    this.scene = scene; this.T = tex; this.items = [];
    const trGeo = new THREE.CylinderGeometry(0.018, 0.018, 1, 4, 1, true); trGeo.translate(0, 0.5, 0); trGeo.rotateX(Math.PI / 2);
    this.trGeo = trGeo;
    this.trMat = new THREE.MeshBasicMaterial({ color: 0x1c1c26, transparent: true, opacity: 0.85 });
    this.tracers = [];
    for (let i = 0; i < 40; i++) { const m = new THREE.Mesh(trGeo, this.trMat.clone()); m.visible = false; scene.add(m); this.tracers.push({ m, t: 0 }); }
    this.splats = [];
    const splatGeo = new THREE.PlaneGeometry(1, 1);
    for (let i = 0; i < 60; i++) {
      const m = new THREE.Mesh(splatGeo, new THREE.MeshBasicMaterial({ map: tex.splat, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
      m.visible = false; scene.add(m); this.splats.push({ m, t: 0 });
    }
    this.splatI = 0; this.trI = 0;
    this.grenades = [];
  }
  tracer(from, to, life = 0.07, thick = 1) {
    const tr = this.tracers[this.trI++ % this.tracers.length];
    const m = tr.m; m.visible = true;
    m.position.copy(from); m.lookAt(to);
    m.scale.set(thick, thick, from.distanceTo(to));
    m.material.opacity = 0.85; tr.t = life; tr.life = life;
  }
  splat(p, n) {
    const s = this.splats[this.splatI++ % this.splats.length];
    s.m.visible = true; s.t = 8;
    s.m.position.set(p.x + n.x * 0.02, p.y + n.y * 0.02, p.z + n.z * 0.02);
    s.m.lookAt(p.x + n.x, p.y + n.y, p.z + n.z);
    s.m.rotateZ(Math.random() * 6);
    const sc = 0.25 + Math.random() * 0.15; s.m.scale.set(sc, sc, 1);
    s.m.material.opacity = 1;
  }
  sprite(tex, pos, size, life, opts = {}) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: opts.depthTest !== false }));
    sp.position.copy(pos); sp.scale.set(size, size, 1); sp.material.rotation = opts.rot ?? Math.random() * 6;
    this.scene.add(sp);
    this.items.push({ sp, life, t: life, size, grow: opts.grow ?? 1, rise: opts.rise ?? 0, spin: opts.spin ?? 0, fadeIn: opts.fadeIn || 0, cloud: opts.cloud });
    return sp;
  }
  hitPuff(p) { this.sprite(this.T.hit, p, 0.35, 0.18, { grow: 1.6 }); }
  boom(p, r) {
    this.sprite(this.T.boom, new THREE.Vector3(p.x, p.y + 0.8, p.z), r * 0.9, 0.55, { grow: 1.5, rot: (Math.random() - 0.5) * 0.4 });
    for (let i = 0; i < 6; i++) this.sprite(this.T.poof, new THREE.Vector3(p.x + (Math.random() - 0.5) * r * 0.8, p.y + 0.3 + Math.random(), p.z + (Math.random() - 0.5) * r * 0.8), 1.2, 0.8 + Math.random() * 0.3, { grow: 1.8, rise: 1.2 });
  }
  poof(p) { this.sprite(this.T.poof, p, 1.4, 0.9, { grow: 1.7, rise: 0.8, rot: (Math.random() - 0.5) * 0.3 }); }
  inkCloud(p) {
    const cloud = { x: p.x, y: p.y + 1.4, z: p.z, r: 0, maxR: 3.6, t: 9 };
    inkClouds.push(cloud);
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * 7, d = Math.random() * 2.4;
      this.sprite(this.T.ink, new THREE.Vector3(p.x + Math.cos(a) * d, p.y + 0.6 + Math.random() * 2.4, p.z + Math.sin(a) * d), 3.2 + Math.random() * 1.6, 9, { grow: 1.15, spin: (Math.random() - 0.5) * 0.4, fadeIn: 0.4, cloud });
    }
    return cloud;
  }
  update(dt) {
    for (const tr of this.tracers) if (tr.t > 0) { tr.t -= dt; tr.m.material.opacity = 0.85 * Math.max(0, tr.t / tr.life); if (tr.t <= 0) tr.m.visible = false; }
    for (const s of this.splats) if (s.t > 0) { s.t -= dt; if (s.t < 1) s.m.material.opacity = s.t; if (s.t <= 0) s.m.visible = false; }
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i]; it.t -= dt;
      const k = 1 - it.t / it.life;
      const sc = it.size * (1 + (it.grow - 1) * Math.min(1, k * (it.cloud ? 6 : 1)));
      it.sp.scale.set(sc, sc, 1);
      it.sp.position.y += it.rise * dt;
      it.sp.material.rotation += it.spin * dt;
      let op = it.t < it.life * 0.25 ? it.t / (it.life * 0.25) : 1;
      if (it.fadeIn) op *= Math.min(1, k * it.life / it.fadeIn);
      it.sp.material.opacity = op;
      if (it.t <= 0) { this.scene.remove(it.sp); it.sp.material.dispose(); this.items.splice(i, 1); }
    }
    for (let i = inkClouds.length - 1; i >= 0; i--) {
      const c = inkClouds[i]; c.t -= dt; c.r = Math.min(c.maxR, c.r + dt * 10) * (c.t < 1 ? c.t : 1);
      if (c.t <= 0) inkClouds.splice(i, 1);
    }
  }
  clear() {
    for (const it of this.items) { this.scene.remove(it.sp); it.sp.material.dispose(); }
    this.items.length = 0; inkClouds.length = 0;
    for (const tr of this.tracers) { tr.t = 0; tr.m.visible = false; }
    for (const s of this.splats) { s.t = 0; s.m.visible = false; }
  }
}

// -------------------------------------------------------------- grenades
const nadeGeo = new THREE.SphereGeometry(0.13, 10, 8);
export function makeGrenadeMesh(type) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(nadeGeo, new THREE.MeshBasicMaterial({ color: type === 'ink' ? 0x2a2a40 : 0x6fa04a })));
  const o = new THREE.Mesh(nadeGeo, new THREE.MeshBasicMaterial({ color: 0x1c1c26, side: THREE.BackSide })); o.scale.setScalar(1.3); g.add(o);
  return g;
}
const hitN = { nx: 0, ny: 0, nz: 0 };
export function stepGrenade(n, dt) {
  n.vy -= 20 * dt;
  const sp = Math.hypot(n.vx, n.vy, n.vz);
  if (sp < 1e-4) return;
  const dx = n.vx / sp, dy = n.vy / sp, dz = n.vz / sp, dist = sp * dt;
  const t = rayWorld(n.x, n.y, n.z, dx, dy, dz, dist + 0.13, hitN);
  if (t < dist + 0.13) {
    const k = Math.max(0, t - 0.13);
    n.x += dx * k; n.y += dy * k; n.z += dz * k;
    const vn = n.vx * hitN.nx + n.vy * hitN.ny + n.vz * hitN.nz;
    n.vx -= 1.5 * vn * hitN.nx; n.vy -= 1.5 * vn * hitN.ny; n.vz -= 1.5 * vn * hitN.nz;
    n.vx *= 0.6; n.vz *= 0.6; n.vy *= 0.6;
    if (hitN.ny > 0.5 && Math.abs(n.vy) < 1.2) { n.vy = 0; n.y = Math.max(n.y, 0.13); n.vx *= 0.8; n.vz *= 0.8; }
    if (n.onBounce) n.onBounce(Math.abs(vn));
  } else { n.x += n.vx * dt; n.y += n.vy * dt; n.z += n.vz * dt; }
  if (n.y < 0.13) { n.y = 0.13; n.vy = Math.abs(n.vy) * 0.4; n.vx *= 0.8; n.vz *= 0.8; }
}

// -------------------------------------------------------------- pickups
export class Pickups {
  constructor(scene, tex, defs) {
    this.list = defs.map(d => {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.pick[d.type], transparent: true, alphaTest: 0.3 }));
      sp.scale.set(0.75, 0.75, 1); scene.add(sp);
      const ring = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.3), new THREE.MeshBasicMaterial({ map: tex.ring, transparent: true, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2; scene.add(ring);
      let gy = 0;
      for (const b of boxes) if (d.x > b.minX && d.x < b.maxX && d.z > b.minZ && d.z < b.maxZ && b.maxY < 1.2) gy = Math.max(gy, b.maxY);
      ring.position.set(d.x, gy + 0.02, d.z);
      return { ...d, gy, sp, ring, active: true, respawnAt: 0, ph: Math.random() * 6 };
    });
  }
  reset() { for (const p of this.list) { p.active = true; p.sp.visible = p.ring.visible = true; } }
  update(t) {
    for (const p of this.list) {
      if (!p.active && t >= p.respawnAt) { p.active = true; p.sp.visible = true; }
      if (p.active) p.sp.position.set(p.x, p.gy + 0.75 + Math.sin(t * 2.5 + p.ph) * 0.12, p.z);
      p.ring.material.opacity = p.active ? 1 : 0.3;
      p.ring.rotation.z = t * 0.5;
    }
  }
  take(p, t) { p.active = false; p.sp.visible = false; p.respawnAt = t + (p.type === 'nade' ? 20 : 15); }
}
