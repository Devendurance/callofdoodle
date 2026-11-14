// Tiny synthesized sound effects (no audio files needed).
let ctx = null, master = null, noiseBuf = null;
export const audio = {
  enabled: true,
  init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch { ctx = null; }
  },
  play(name, vol = 1) {
    if (!ctx || !this.enabled) return;
    const fn = SFX[name]; if (fn) try { fn(ctx.currentTime, Math.max(0, Math.min(1, vol))); } catch {}
  },
};

function noise(t, dur, freq, q, vol, type = 'lowpass', sweep) {
  const src = ctx.createBufferSource(); src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
}
function tone(t, dur, f0, f1, vol, type = 'square') {
  const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t);
  if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
}

const SFX = {
  rifle: (t, v) => { noise(t, 0.12, 2400, 0.8, 0.55 * v, 'lowpass', 300); tone(t, 0.06, 180, 60, 0.25 * v); },
  sniper: (t, v) => { noise(t, 0.45, 3000, 0.7, 0.8 * v, 'lowpass', 120); tone(t, 0.25, 120, 40, 0.45 * v, 'sawtooth'); },
  smg: (t, v) => { noise(t, 0.08, 3200, 0.9, 0.42 * v, 'lowpass', 500); tone(t, 0.04, 240, 90, 0.18 * v); },
  shotgun: (t, v) => { noise(t, 0.35, 1800, 0.6, 0.9 * v, 'lowpass', 90); tone(t, 0.18, 110, 40, 0.5 * v, 'sawtooth'); },
  flashbang: (t, v) => { noise(t, 0.5, 6000, 0.5, 0.9 * v, 'highpass', 2000); tone(t, 1.4, 3800, 3600, 0.08 * v, 'sine'); },
  shock: (t, v) => { tone(t, 0.5, 160, 50, 0.5 * v, 'sine'); noise(t, 0.4, 500, 2, 0.4 * v, 'bandpass', 120); },
  stim: (t, v) => { [440, 660, 880].forEach((f, i) => tone(t + i * 0.07, 0.12, f, 0, 0.16 * v, 'triangle')); },
  fire: (t, v) => { noise(t, 0.7, 900, 1.5, 0.5 * v, 'bandpass', 300); },
  beep: (t, v) => { tone(t, 0.06, 1500, 0, 0.12 * v, 'square'); },
  enemyShot: (t, v) => { noise(t, 0.09, 1800, 0.8, 0.35 * v, 'lowpass', 400); },
  hit: (t, v) => { tone(t, 0.05, 1400, 900, 0.18 * v, 'triangle'); },
  head: (t, v) => { tone(t, 0.07, 2000, 2600, 0.22 * v, 'triangle'); tone(t + 0.05, 0.08, 2600, 3000, 0.15 * v, 'triangle'); },
  kill: (t, v) => { tone(t, 0.09, 660, 0, 0.2 * v, 'square'); tone(t + 0.09, 0.16, 990, 0, 0.2 * v, 'square'); },
  hurt: (t, v) => { noise(t, 0.18, 600, 2, 0.5 * v, 'bandpass'); tone(t, 0.15, 220, 110, 0.18 * v, 'sawtooth'); },
  boom: (t, v) => { noise(t, 0.9, 900, 0.6, 1.0 * v, 'lowpass', 60); tone(t, 0.5, 90, 30, 0.6 * v, 'sine'); },
  ink: (t, v) => { noise(t, 0.6, 400, 4, 0.6 * v, 'bandpass', 150); },
  reload: (t, v) => { tone(t, 0.04, 900, 700, 0.15 * v, 'square'); tone(t + 0.35, 0.05, 600, 900, 0.18 * v, 'square'); },
  empty: (t, v) => { tone(t, 0.03, 1200, 1000, 0.12 * v, 'square'); },
  jump: (t, v) => { tone(t, 0.12, 300, 600, 0.08 * v, 'triangle'); },
  pickup: (t, v) => { tone(t, 0.08, 700, 0, 0.15 * v, 'triangle'); tone(t + 0.08, 0.12, 1050, 0, 0.15 * v, 'triangle'); },
  throw: (t, v) => { noise(t, 0.15, 1200, 1, 0.3 * v, 'bandpass', 500); },
  swap: (t, v) => { tone(t, 0.05, 500, 800, 0.1 * v, 'square'); },
  step: (t, v) => { noise(t, 0.05, 500, 1, 0.12 * v, 'lowpass'); },
  click: (t, v) => { tone(t, 0.04, 800, 600, 0.12 * v, 'triangle'); },
  win: (t, v) => { [523, 659, 784, 1046].forEach((f, i) => tone(t + i * 0.13, 0.25, f, 0, 0.2 * v, 'square')); },
  lose: (t, v) => { [392, 330, 262].forEach((f, i) => tone(t + i * 0.18, 0.3, f, 0, 0.2 * v, 'triangle')); },
  levelup: (t, v) => { [523, 784, 1046, 1568].forEach((f, i) => tone(t + i * 0.09, 0.2, f, 0, 0.18 * v, 'triangle')); },
};
