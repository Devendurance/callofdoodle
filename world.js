// Map, doodle shaders, collision, line-of-sight and navigation.
import * as THREE from 'three';
THREE.ColorManagement.enabled = false;

export const PAPER = new THREE.Color('#f7f2e4');
export const INK = new THREE.Color('#1c1c26');
export const HALF = 32;          // arena is 64 x 64
export const STEP = 0.55;
export const GRAVITY = 20;

export const shared = { uT: { value: 0 }, uFogNear: { value: 22 }, uFogFar: { value: 70 } };

const NOISE = /* glsl */`
float h21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(h21(i),h21(i+vec2(1.,0.)),f.x), mix(h21(i+vec2(0.,1.)),h21(i+vec2(1.,1.)),f.x), f.y); }
`;

// ------------------------------------------------------------ doodle material
export function doodleMaterial({ edge = 1, tint = 0xffffff, hatch = 1, fog = true } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uT: shared.uT, uFogNear: shared.uFogNear, uFogFar: shared.uFogFar,
      uPaper: { value: PAPER }, uInk: { value: INK },
      uEdge: { value: edge }, uTint: { value: new THREE.Color(tint) }, uHatch: { value: hatch },
      uFlash: { value: 0 }, uFog: { value: fog ? 1 : 0 },
    },
    vertexShader: /* glsl */`
      attribute vec2 uvm; attribute vec2 fsize; attribute vec3 acol;
      varying vec2 vUvm; varying vec2 vSize; varying vec3 vN; varying vec3 vCol; varying float vDepth;
      void main(){
        vec4 w = modelMatrix * vec4(position,1.0);
        vN = normalize(mat3(modelMatrix) * normal);
        vUvm = uvm; vSize = fsize; vCol = acol;
        vec4 mv = viewMatrix * w; vDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform float uT, uFogNear, uFogFar, uEdge, uHatch, uFlash, uFog;
      uniform vec3 uPaper, uInk, uTint;
      varying vec2 vUvm; varying vec2 vSize; varying vec3 vN; varying vec3 vCol; varying float vDepth;
      ${NOISE}
      void main(){
        vec3 n = normalize(vN);
        float l = dot(n, normalize(vec3(.45,.8,.3)))*.5+.5;
        float dark = clamp(1.0-l, 0.0, 1.0);
        float jit = (vn(vUvm*2.7 + uT*13.1)-.5)*0.035;
        float d = min(min(vUvm.x, vSize.x-vUvm.x), min(vUvm.y, vSize.y-vUvm.y));
        float w = (0.05 + jit) * uEdge;
        float aa = fwidth(d) + 1e-4;
        float edge = 1.0 - smoothstep(w-aa, w+aa, d);
        float hc = (vUvm.x + vUvm.y) * 5.5 + vn(vUvm*1.7 + uT*5.0)*0.7;
        float hl = abs(fract(hc)-.5);
        float haa = fwidth(hc);
        float hatch = (1.0 - smoothstep(0.07-haa, 0.07+haa, hl)) * smoothstep(0.38,0.5,dark);
        float hc2 = (vUvm.x - vUvm.y) * 5.5 + vn(vUvm*1.9 - uT*4.0)*0.7;
        float hl2 = abs(fract(hc2)-.5); float haa2 = fwidth(hc2);
        float hatch2 = (1.0 - smoothstep(0.07-haa2, 0.07+haa2, hl2)) * smoothstep(0.62,0.72,dark);
        float hfade = (1.0 - smoothstep(14.0, 34.0, vDepth)) * (1.0 - smoothstep(0.25, 0.5, haa)) * uHatch;
        vec3 col = vCol * uTint * mix(1.0, 0.88, dark);
        col = mix(col, uInk, clamp(edge*0.95 + (hatch + hatch2)*0.5*hfade, 0.0, 1.0));
        col = mix(col, vec3(1.0,0.35,0.3), uFlash);
        col = mix(col, uPaper, smoothstep(uFogNear, uFogFar, vDepth) * uFog);
        gl_FragColor = vec4(col, 1.0);
      }`,
    side: THREE.FrontSide,
  });
}

// ------------------------------------------------------------ box geometry builder
export class BoxBuilder {
  constructor(uvScale = 1) { this.k = uvScale; this.p = []; this.n = []; this.uv = []; this.fs = []; this.c = []; this.idx = []; this.v = 0; }
  // axis-aligned box centred at (cx,cy,cz) with size (sx,sy,sz)
  box(cx, cy, cz, sx, sy, sz, color = '#fbf8ef') {
    const col = new THREE.Color(color);
    const hx = sx / 2, hy = sy / 2, hz = sz / 2;
    // each face: normal, u axis, v axis, size u, size v
    const faces = [
      [[1, 0, 0], [0, 0, -1], [0, 1, 0], sz, sy],
      [[-1, 0, 0], [0, 0, 1], [0, 1, 0], sz, sy],
      [[0, 1, 0], [1, 0, 0], [0, 0, -1], sx, sz],
      [[0, -1, 0], [1, 0, 0], [0, 0, 1], sx, sz],
      [[0, 0, 1], [1, 0, 0], [0, 1, 0], sx, sy],
      [[0, 0, -1], [-1, 0, 0], [0, 1, 0], sx, sy],
    ];
    for (const [nn, ua, va, su, sv] of faces) {
      const c = [cx + nn[0] * hx, cy + nn[1] * hy, cz + nn[2] * hz];
      const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
      for (const [a, b] of corners) {
        this.p.push(
          c[0] + ua[0] * a * su / 2 + va[0] * b * sv / 2,
          c[1] + ua[1] * a * su / 2 + va[1] * b * sv / 2,
          c[2] + ua[2] * a * su / 2 + va[2] * b * sv / 2);
        this.n.push(...nn);
        this.uv.push((a + 1) / 2 * su * this.k, (b + 1) / 2 * sv * this.k);
        this.fs.push(su * this.k, sv * this.k);
        this.c.push(col.r, col.g, col.b);
      }
      const v = this.v;
      this.idx.push(v, v + 1, v + 2, v, v + 2, v + 3);
      this.v += 4;
    }
    return this;
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uvm', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('fsize', new THREE.Float32BufferAttribute(this.fs, 2));
    g.setAttribute('acol', new THREE.Float32BufferAttribute(this.c, 3));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  }
}

// ------------------------------------------------------------ the map
export const boxes = [];   // collision boxes {minX,maxX,minY,maxY,minZ,maxZ}
const P = '#fbf8ef';
function solid(b, x0, x1, z0, z1, h, color = P, y0 = 0) {
  const minX = Math.min(x0, x1), maxX = Math.max(x0, x1), minZ = Math.min(z0, z1), maxZ = Math.max(z0, z1);
  boxes.push({ minX, maxX, minY: y0, maxY: y0 + h, minZ, maxZ });
  b.box((minX + maxX) / 2, y0 + h / 2, (minZ + maxZ) / 2, maxX - minX, h, maxZ - minZ, color);
}
function deco(b, x0, x1, z0, z1, y0, y1, color) { // visual only
  const minX = Math.min(x0, x1), maxX = Math.max(x0, x1), minZ = Math.min(z0, z1), maxZ = Math.max(z0, z1);
  b.box((minX + maxX) / 2, (y0 + y1) / 2, (minZ + maxZ) / 2, maxX - minX, y1 - y0, maxZ - minZ, color);
}

const BOOK = ['#f4a9a0', '#9fc4ef', '#b7e0a5', '#f7d774', '#d6b3f0', '#f6c09a'];

export function buildMap(scene) {
  boxes.length = 0;
  const b = new BoxBuilder();
  // outer walls (notebook covers)
  const W = HALF, T = 1, H = 4.5;
  solid(b, -W - T, W + T, -W - T, -W, H, '#efe4c8');
  solid(b, -W - T, W + T, W, W + T, H, '#efe4c8');
  solid(b, -W - T, -W, -W, W, H, '#efe4c8');
  solid(b, W, W + T, -W, W, H, '#efe4c8');

  // central platform with steps and a cover block on top
  solid(b, -5, 5, -5, 5, 1.0, '#fbf8ef');
  solid(b, -1.6, 1.6, 5, 6.4, 0.5); solid(b, -1.6, 1.6, -6.4, -5, 0.5);
  solid(b, 5, 6.4, -1.6, 1.6, 0.5); solid(b, -6.4, -5, -1.6, 1.6, 0.5);
  solid(b, -1.1, 1.1, -1.1, 1.1, 1.7, '#f7d774', 1.0);
  solid(b, -4.6, -3.4, 3.4, 4.6, 0.9, '#f4a9a0', 1.0);
  solid(b, 3.4, 4.6, -4.6, -3.4, 0.9, '#9fc4ef', 1.0);

  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    // L-shaped walls in each quadrant
    solid(b, sx * 11, sx * 20, sz * 11, sz * 12, 3.0);
    solid(b, sx * 11, sx * 12, sz * 12, sz * 18, 3.0);
    // pillars
    solid(b, sx * 7.4, sx * 8.6, sz * 19.4, sz * 20.6, 4.0, '#fbf8ef');
    solid(b, sx * 19.4, sx * 20.6, sz * 7.4, sz * 8.6, 4.0, '#fbf8ef');
    // low crates
    solid(b, sx * 15, sx * 16.4, sz * 15, sz * 16.4, 1.0, '#f3e3c3');
    solid(b, sx * 24, sx * 25.4, sz * 14, sz * 15.4, 1.0, '#f3e3c3');
    solid(b, sx * 14, sx * 15.4, sz * 24, sz * 25.4, 1.0, '#f3e3c3');
    solid(b, sx * 24.2, sx * 25.2, sz * 15.4, sz * 16.4, 2.0, '#f3e3c3');
    solid(b, sx * 6, sx * 7.4, sz * 9, sz * 10.4, 1.0, '#f3e3c3');
    // eraser blocks
    solid(b, sx * 26, sx * 28.6, sz * 25, sz * 26.2, 1.0, '#f5b6c8');
    // corner book stacks
    const bx = sx * 27, bz = sz * 4;
    solid(b, bx - 1.6, bx + 1.6, bz - 1.1, bz + 1.1, 0.6, BOOK[(sx + sz + 4) % 6]);
    solid(b, bx - 1.4, bx + 1.5, bz - 1.0, bz + 1.0, 0.6, BOOK[(sx + 2 * sz + 5) % 6], 0.6);
    solid(b, bx - 1.5, bx + 1.3, bz - 1.05, bz + 0.9, 0.6, BOOK[(2 * sx + sz + 6) % 6], 1.2);
    const cx = sx * 4, cz = sz * 27;
    solid(b, cx - 1.1, cx + 1.1, cz - 1.6, cz + 1.6, 0.6, BOOK[(sx + sz + 7) % 6]);
    solid(b, cx - 1.0, cx + 1.0, cz - 1.4, cz + 1.5, 0.6, BOOK[(sx + 3 * sz + 8) % 6], 0.6);
    solid(b, cx - 1.05, cx + 0.9, cz - 1.5, cz + 1.3, 0.6, BOOK[(3 * sx + sz + 9) % 6], 1.2);
  }
  // mid-lane walls (taller than eye height)
  solid(b, -6, 6, 13.5, 14.5, 2.2); solid(b, -6, 6, -14.5, -13.5, 2.2);
  solid(b, 13.5, 14.5, -6, 6, 2.2); solid(b, -14.5, -13.5, -6, 6, 2.2);

  // giant pencils lying on the floor (jumpable cover)
  for (const s of [-1, 1]) {
    const z = s * 22, x0 = -9, x1 = 3;
    solid(b, x0, x1, z - 0.45, z + 0.45, 0.9, '#f7cf3d');
    deco(b, x0 - 1.2, x0, z - 0.45, z + 0.45, 0, 0.9, '#f5a3b8'); // eraser
    deco(b, x0 - 0.05, x0 + 0.35, z - 0.47, z + 0.47, 0, 0.92, '#c8c8cf'); // ferrule
    deco(b, x1, x1 + 1.3, z - 0.32, z + 0.32, 0.13, 0.77, '#f1d6ad'); // wood tip
    deco(b, x1 + 1.3, x1 + 1.8, z - 0.14, z + 0.14, 0.31, 0.59, '#2a2a35'); // graphite
    boxes.push({ minX: x0 - 1.2, maxX: x0, minY: 0, maxY: 0.9, minZ: z - 0.45, maxZ: z + 0.45 });
    boxes.push({ minX: x1, maxX: x1 + 1.3, minY: 0, maxY: 0.77, minZ: z - 0.32, maxZ: z + 0.32 });
    const x = s * 22, z0 = -3, z1 = 9;
    solid(b, x - 0.45, x + 0.45, z0 * s, z1 * s, 0.9, '#7fc4f0');
    deco(b, x - 0.32, x + 0.32, z1 * s, (z1 + 1.3) * s, 0.13, 0.77, '#f1d6ad');
    deco(b, x - 0.14, x + 0.14, (z1 + 1.3) * s, (z1 + 1.8) * s, 0.31, 0.59, '#2f5fd0');
    boxes.push({ minX: x - 0.32, maxX: x + 0.32, minY: 0, maxY: 0.77, minZ: Math.min(z1 * s, (z1 + 1.3) * s), maxZ: Math.max(z1 * s, (z1 + 1.3) * s) });
  }

  const mesh = new THREE.Mesh(b.build(), doodleMaterial());
  scene.add(mesh);

  // ruled-paper floor
  const floorMat = new THREE.ShaderMaterial({
    uniforms: { uT: shared.uT, uFogNear: shared.uFogNear, uFogFar: shared.uFogFar, uPaper: { value: PAPER } },
    vertexShader: /* glsl */`varying vec3 vW; varying float vDepth;
      void main(){ vec4 w = modelMatrix*vec4(position,1.); vW=w.xyz; vec4 mv=viewMatrix*w; vDepth=-mv.z; gl_Position=projectionMatrix*mv; }`,
    fragmentShader: /* glsl */`uniform float uT, uFogNear, uFogFar; uniform vec3 uPaper; varying vec3 vW; varying float vDepth;
      ${NOISE}
      float line(float c, float w){ float d = abs(fract(c)-.5); float aa = fwidth(c); return 1.-smoothstep(w-aa, w+aa, d); }
      void main(){
        vec3 col = vec3(0.973,0.953,0.898);
        col -= (vn(vW.xz*3.1)-.5)*0.035;
        float rule = line(vW.z/1.6 + 0.5, 0.035) * (1.0 - smoothstep(20., 50., vDepth));
        col = mix(col, vec3(0.55,0.72,0.9), rule*0.8);
        float m1 = 1.-smoothstep(0.03,0.07, abs(vW.x + 24.0));
        float m2 = 1.-smoothstep(0.03,0.07, abs(vW.x + 23.7));
        col = mix(col, vec3(0.9,0.45,0.45), max(m1,m2)*0.8);
        // pencil smudges around the middle
        float sm = smoothstep(0.62, 0.8, vn(vW.xz*0.25+3.0)) * 0.08;
        col -= sm;
        col = mix(col, uPaper, smoothstep(uFogNear, uFogFar, vDepth));
        gl_FragColor = vec4(col,1.);
      }`,
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2 + 2, HALF * 2 + 2), floorMat);
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  // sky doodles: a sun and some clouds drawn far away
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTex(drawSun, 256), fog: false, depthWrite: false }));
  sun.position.set(60, 55, -80); sun.scale.set(28, 28, 1); scene.add(sun);
  const cloudTex = canvasTex(drawCloud, 256);
  for (let i = 0; i < 9; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, fog: false, depthWrite: false, transparent: true }));
    const a = (i / 9) * Math.PI * 2 + 0.3;
    s.position.set(Math.cos(a) * 95, 38 + (i % 3) * 7, Math.sin(a) * 95);
    s.scale.set(34, 17, 1); scene.add(s);
  }
  buildNav();
  return mesh;
}

export function canvasTex(draw, w, h = w) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 2;
  return t;
}
function drawSun(ctx, s) {
  ctx.strokeStyle = '#1c1c26'; ctx.lineWidth = 6; ctx.lineCap = 'round';
  ctx.fillStyle = '#f7d774';
  ctx.beginPath(); ctx.arc(s / 2, s / 2, s * 0.22, 0, 7); ctx.fill(); ctx.stroke();
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(s / 2 + Math.cos(a) * s * 0.3, s / 2 + Math.sin(a) * s * 0.3);
    ctx.lineTo(s / 2 + Math.cos(a + 0.05) * s * 0.44, s / 2 + Math.sin(a + 0.05) * s * 0.44); ctx.stroke();
  }
  ctx.fillStyle = '#1c1c26';
  ctx.beginPath(); ctx.arc(s * 0.44, s * 0.46, 6, 0, 7); ctx.arc(s * 0.56, s * 0.46, 6, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(s / 2, s * 0.52, s * 0.08, 0.2, Math.PI - 0.2); ctx.stroke();
}
function drawCloud(ctx, w, h) {
  ctx.strokeStyle = '#1c1c26'; ctx.lineWidth = 5; ctx.fillStyle = '#fffdf6';
  ctx.beginPath();
  const pts = [[0.2, 0.62, 0.14], [0.36, 0.45, 0.2], [0.58, 0.4, 0.22], [0.78, 0.58, 0.15]];
  for (const [x, y, r] of pts) { ctx.moveTo(x * w + r * w, y * h); ctx.arc(x * w, y * h, r * w, 0, 7); }
  ctx.fill();
  for (const [x, y, r] of pts) { ctx.beginPath(); ctx.arc(x * w, y * h, r * w, Math.PI * 0.95, Math.PI * 2.05); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(0.07 * w, 0.68 * h); ctx.lineTo(0.92 * w, 0.68 * h); ctx.stroke();
}

// ------------------------------------------------------------ collision
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export function groundAt(x, z, r, maxTop) {
  let g = 0;
  for (const bx of boxes) {
    if (bx.maxY > maxTop + 1e-3 || bx.maxY <= g) continue;
    const cx = clamp(x, bx.minX, bx.maxX), cz = clamp(z, bx.minZ, bx.maxZ);
    const dx = x - cx, dz = z - cz;
    if (dx * dx + dz * dz < r * r) g = bx.maxY;
  }
  return g;
}
export function moveBody(b, dx, dz, dt) {
  b.x += dx; b.z += dz;
  for (let it = 0; it < 3; it++) {
    for (const bx of boxes) {
      if (bx.maxY <= b.y + STEP || bx.minY >= b.y + b.h) continue;
      const cx = clamp(b.x, bx.minX, bx.maxX), cz = clamp(b.z, bx.minZ, bx.maxZ);
      const ox = b.x - cx, oz = b.z - cz, d2 = ox * ox + oz * oz;
      if (d2 >= b.r * b.r) continue;
      if (d2 > 1e-9) { const d = Math.sqrt(d2), k = (b.r - d) / d; b.x += ox * k; b.z += oz * k; }
      else {
        const l = b.x - bx.minX, r = bx.maxX - b.x, n = b.z - bx.minZ, f = bx.maxZ - b.z, m = Math.min(l, r, n, f);
        if (m === l) b.x = bx.minX - b.r; else if (m === r) b.x = bx.maxX + b.r; else if (m === n) b.z = bx.minZ - b.r; else b.z = bx.maxZ + b.r;
      }
    }
  }
  const lim = HALF - b.r;
  b.x = clamp(b.x, -lim, lim); b.z = clamp(b.z, -lim, lim);

  b.vy -= GRAVITY * dt;
  let ny = b.y + b.vy * dt;
  if (b.vy > 0) {
    for (const bx of boxes) {
      if (bx.minY < b.y + b.h - 0.05 || bx.minY > ny + b.h) continue;
      const cx = clamp(b.x, bx.minX, bx.maxX), cz = clamp(b.z, bx.minZ, bx.maxZ);
      const dx = b.x - cx, dz = b.z - cz;
      if (dx * dx + dz * dz < b.r * b.r) { ny = bx.minY - b.h; b.vy = 0; }
    }
  }
  const g = groundAt(b.x, b.z, b.r * 0.8, b.y + STEP);
  if (ny <= g) { ny = g; if (b.vy < 0) b.vy = 0; b.onGround = true; }
  else b.onGround = false;
  b.y = ny;
}
export function blockedAt(x, z, r, y, h) {
  for (const bx of boxes) {
    if (bx.maxY <= y + STEP || bx.minY >= y + h) continue;
    const cx = clamp(x, bx.minX, bx.maxX), cz = clamp(z, bx.minZ, bx.maxZ);
    const dx = x - cx, dz = z - cz;
    if (dx * dx + dz * dz < r * r) return true;
  }
  return Math.abs(x) > HALF - r || Math.abs(z) > HALF - r;
}

// ray (o, unit d) vs boxes; returns distance of first hit or Infinity, also normal in out
export function rayWorld(ox, oy, oz, dx, dy, dz, maxT = 200, out = null) {
  let best = maxT, nx = 0, ny = 0, nz = 0;
  if (dy < -1e-6) { const t = -oy / dy; if (t > 0 && t < best) { best = t; nx = 0; ny = 1; nz = 0; } }
  const ix = 1 / dx, iy = 1 / dy, iz = 1 / dz;
  for (const b of boxes) {
    let t1 = (b.minX - ox) * ix, t2 = (b.maxX - ox) * ix;
    let tmin = Math.min(t1, t2), tmax = Math.max(t1, t2), ax = 0;
    t1 = (b.minY - oy) * iy; t2 = (b.maxY - oy) * iy;
    let a = Math.min(t1, t2), c = Math.max(t1, t2);
    if (a > tmin) { tmin = a; ax = 1; } if (c < tmax) tmax = c;
    t1 = (b.minZ - oz) * iz; t2 = (b.maxZ - oz) * iz;
    a = Math.min(t1, t2); c = Math.max(t1, t2);
    if (a > tmin) { tmin = a; ax = 2; } if (c < tmax) tmax = c;
    if (tmax >= Math.max(tmin, 0) && tmin > 0 && tmin < best) {
      best = tmin;
      nx = ax === 0 ? -Math.sign(dx) : 0; ny = ax === 1 ? -Math.sign(dy) : 0; nz = ax === 2 ? -Math.sign(dz) : 0;
    }
  }
  if (out) { out.nx = nx; out.ny = ny; out.nz = nz; }
  return best;
}
// clear line between two points? (also checks ink clouds)
export const inkClouds = [];
export function lineClear(ax, ay, az, bx, by, bz, checkInk = true) {
  let dx = bx - ax, dy = by - ay, dz = bz - az;
  const L = Math.hypot(dx, dy, dz); if (L < 1e-4) return true;
  dx /= L; dy /= L; dz /= L;
  if (rayWorld(ax, ay, az, dx, dy, dz, L) < L - 0.05) return false;
  if (checkInk) for (const c of inkClouds) {
    const px = c.x - ax, py = c.y - ay, pz = c.z - az;
    const t = clamp(px * dx + py * dy + pz * dz, 0, L);
    const qx = ax + dx * t - c.x, qy = ay + dy * t - c.y, qz = az + dz * t - c.z;
    if (qx * qx + qy * qy + qz * qz < c.r * c.r) return false;
  }
  return true;
}

// ------------------------------------------------------------ navigation grid (1m cells)
const N = HALF * 2;
let walk = null;
function cellOf(v) { return clamp(Math.floor(v + HALF), 0, N - 1); }
function buildNav() {
  walk = new Uint8Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = i - HALF + 0.5, z = j - HALF + 0.5;
    let ok = Math.abs(x) < HALF - 0.6 && Math.abs(z) < HALF - 0.6;
    if (ok) for (const b of boxes) {
      if (b.maxY <= 1.05) continue;
      const cx = clamp(x, b.minX, b.maxX), cz = clamp(z, b.minZ, b.maxZ);
      if ((x - cx) ** 2 + (z - cz) ** 2 < 0.6 * 0.6) { ok = false; break; }
    }
    walk[j * N + i] = ok ? 1 : 0;
  }
}
export function walkable(x, z) { return walk[cellOf(z) * N + cellOf(x)] === 1; }
export function randomWalkable(rand = Math.random) {
  for (let k = 0; k < 200; k++) {
    const x = (rand() * 2 - 1) * (HALF - 2), z = (rand() * 2 - 1) * (HALF - 2);
    if (walkable(x, z)) return { x, z };
  }
  return { x: 0, z: 8 };
}
const gScore = new Float32Array(N * N), came = new Int32Array(N * N), closed = new Uint8Array(N * N);
export function findPath(sx, sz, tx, tz) {
  const s = cellOf(sz) * N + cellOf(sx);
  let t = cellOf(tz) * N + cellOf(tx);
  if (!walk[t]) return null;
  gScore.fill(1e9); came.fill(-1); closed.fill(0);
  const heap = []; // [f, idx]
  const push = (f, i) => { heap.push([f, i]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
  const ti = t % N, tj = (t / N) | 0;
  const hfn = (i) => { const dx = Math.abs(i % N - ti), dz = Math.abs(((i / N) | 0) - tj); return Math.max(dx, dz) + 0.414 * Math.min(dx, dz); };
  gScore[s] = 0; push(hfn(s), s);
  let iter = 0;
  while (heap.length && iter++ < 5000) {
    const [, cur] = pop();
    if (cur === t) break;
    if (closed[cur]) continue; closed[cur] = 1;
    const ci = cur % N, cj = (cur / N) | 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const ni = ci + di, nj = cj + dj;
      if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue;
      const nIdx = nj * N + ni;
      if (!walk[nIdx]) continue;
      if (di && dj && (!walk[cj * N + ni] || !walk[nj * N + ci])) continue;
      const g = gScore[cur] + (di && dj ? 1.414 : 1);
      if (g < gScore[nIdx]) { gScore[nIdx] = g; came[nIdx] = cur; push(g + hfn(nIdx), nIdx); }
    }
  }
  if (came[t] === -1 && t !== s) return null;
  const path = [];
  for (let c = t; c !== -1 && c !== s; c = came[c]) path.push({ x: (c % N) - HALF + 0.5, z: ((c / N) | 0) - HALF + 0.5 });
  path.reverse();
  // string-pull: drop points that have a clear straight line
  const out = [];
  let ax = sx, az = sz, k = 0;
  while (k < path.length) {
    let far = k;
    for (let m = path.length - 1; m > k; m--) { if (gridLine(ax, az, path[m].x, path[m].z)) { far = m; break; } }
    out.push(path[far]); ax = path[far].x; az = path[far].z; k = far + 1;
  }
  return out;
}
function gridLine(ax, az, bx, bz) {
  const L = Math.hypot(bx - ax, bz - az), n = Math.ceil(L / 0.4);
  for (let i = 1; i <= n; i++) { const t = i / n; if (!walkable(ax + (bx - ax) * t, az + (bz - az) * t)) return false; }
  return true;
}

export const SPAWNS = [
  [0, 9], [0, -9], [9, 0], [-9, 0], [17, 25], [-17, 25], [17, -25], [-17, -25],
  [25, 17], [-25, 17], [25, -17], [-25, -17], [28, 28], [-28, 28], [28, -28], [-28, -28],
  [9, 17], [-9, -17], [17, -9], [-17, 9], [6, 28], [-6, -28], [28, -6], [-28, 6],
].map(([x, z]) => ({ x, z }));
export const PICKUPS = [
  { type: 'health', x: 0, z: 3 }, { type: 'health', x: 16, z: 19 }, { type: 'health', x: -16, z: -19 },
  { type: 'health', x: -26, z: 20 }, { type: 'health', x: 26, z: -20 },
  { type: 'armor', x: 19, z: -16 }, { type: 'armor', x: -19, z: 16 }, { type: 'armor', x: 0, z: 18 }, { type: 'armor', x: 0, z: -18 },
  { type: 'ammo', x: 10, z: 10 }, { type: 'ammo', x: -10, z: -10 }, { type: 'ammo', x: 10, z: -10 }, { type: 'ammo', x: -10, z: 10 },
  { type: 'nade', x: 28, z: 0 }, { type: 'nade', x: -28, z: 0 }, { type: 'nade', x: 0, z: 28.5 }, { type: 'nade', x: 0, z: -28.5 },
];
// sanity-check spawn/pickup spots against the map (called after buildMap)
export function validateSpots() {
  const bad = [];
  for (const s of SPAWNS) if (blockedAt(s.x, s.z, 0.45, 0, 1.7)) bad.push(['spawn', s]);
  for (const p of PICKUPS) if (blockedAt(p.x, p.z, 0.3, 0, 1.7)) bad.push(['pickup', p]);
  return bad;
}
