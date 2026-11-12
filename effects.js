'use strict';

const effects = [
  { id: 'respawn', name: 'Respawn Beam', category: 'Spawn', style: 'beam', colors: ['#295b71', '#4fdcc8', '#baffdf'] },
  { id: 'poof', name: 'Ghost Poof', category: 'Spawn', style: 'cloud', colors: ['#514279', '#a288e1', '#e7d3ff'] },
  { id: 'ember', name: 'Ember Flame', category: 'Fire', style: 'flame', colors: ['#aa2634', '#ff7447', '#ffda76'], loop: true },
  { id: 'burst', name: 'Solar Burst', category: 'Impact', style: 'burst', colors: ['#ab383a', '#ff8b4b', '#fff59e'] },
  { id: 'slash', name: 'Moon Slash', category: 'Impact', style: 'slash', colors: ['#473e97', '#8981ff', '#f3deff'] },
  { id: 'heal', name: 'Healing Ring', category: 'Magic', style: 'ring', colors: ['#24654f', '#74e472', '#ebffc6'], loop: true },
  { id: 'nova', name: 'Frost Nova', category: 'Magic', style: 'burst', colors: ['#254c89', '#59c5ff', '#e3fbff'] },
  { id: 'spark', name: 'Static Arc', category: 'Electric', style: 'arc', colors: ['#3f358e', '#a174ff', '#f5e8ff'], loop: true }
].map(effect => ({ width: 64, height: 64, frames: 24, fps: 18, loop: false, ...effect }));

const palettes = {
  ember: ['#8c2436', '#ff6c4b', '#ffe291'],
  mint: ['#1d755c', '#55e1aa', '#e2ffd5'],
  violet: ['#52328a', '#b16df3', '#ffdbff'],
  ice: ['#255692', '#60cfff', '#f0ffff']
};

function drawEffect(ctx, effect, frame, colors, seed) {
  const t = frame / (effect.frames - 1);
  const pulse = Math.sin(Math.PI * t);
  const tau = 2 * Math.PI;
  let state = seed | 0;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) | 0;
    return (state >>> 0) / 4294967296;
  };
  function dot(x, y, size, shade, alpha = 1) {
    const n = Math.max(1, Math.round(size));
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.fillStyle = colors[shade];
    ctx.fillRect(Math.round(x - n / 2), Math.round(y - n / 2), n, n);
  }
  function ring(x, y, radius, verticalScale, shade, alpha, offset = 0, sweep = tau) {
    for (let angle = 0; angle <= sweep; angle += .038) {
      const a = angle + offset;
      dot(x + Math.cos(a) * radius, y + Math.sin(a) * radius * verticalScale, 2, shade, alpha);
    }
  }
  if (effect.style === 'beam') {
    const width = 10 * Math.pow(pulse, 1.6);
    for (let x = -Math.ceil(width); x <= width; x++) {
      for (let y = 5; y <= 47; y++) {
        const core = Math.abs(x) / Math.max(width, 1);
        if (random() > core * .44 + (47 - y) / 120) {
          dot(32 + x, y, 1, core < .25 ? 2 : core < .65 ? 1 : 0, pulse * (.3 + y / 70));
        }
      }
    }
    ring(32, 47, 3 + 25 * t, .31, 1, pulse);
  }
  if (effect.style === 'slash') {
    for (let layer = 0; layer < 6; layer++) {
      ring(29, 37, 24 - layer, .8, layer < 2 ? 2 : 1, pulse * (1 - layer / 8), -2.9 + 3.4 * t, 1.9);
    }
  }
  if (effect.style === 'ring') {
    ring(32, 45, 18 + 2 * Math.cos(t * tau), .35, 0, 1);
    ring(32, 43, 15, .35, 1, .7);
    ring(32, 42, 13, .35, 2, .8, t * tau, 1.4);
  }
  if (effect.style === 'arc') {
    let x = 32;
    const bends = Array.from({ length: 7 }, (_, i) => 32 + Math.round(10 * Math.sin(i * 2.1 + t * tau + random())));
    for (let y = 8; y < 54; y++) {
      const segment = Math.floor((y - 8) / 8);
      const next = bends[segment] + (bends[segment + 1] - bends[segment]) * ((y - 8) % 8) / 8;
      for (let px = Math.floor(Math.min(x, next)); px <= Math.ceil(Math.max(x, next)); px++) {
        dot(px, y, 4, 0, .65);
        dot(px, y, 2, 1);
        dot(px, y, 1, 2);
      }
      x = next;
    }
  }
  if (effect.style === 'burst') {
    ring(32, 34, 2 + 28 * t, .88, 1, pulse * (1 - t));
    dot(32, 34, 18 * pulse * (1 - t), 1, pulse * (1 - t));
    dot(32, 34, 9 * pulse, 2, pulse);
  }
  for (let i = 0; i < 65; i++) {
    const a = random() * tau;
    const speed = .28 + random() * .72;
    const phase = random();
    const age = effect.loop ? (t + phase) % 1 : t;
    const size = 1 + random() * 5;
    const radius = (3 + 26 * age) * speed;
    let x = 32 + Math.cos(a) * radius;
    let y = 34 + Math.sin(a) * radius;
    let alpha = Math.sin(Math.PI * age);
    if (effect.style === 'flame' || effect.style === 'ring' || effect.style === 'beam') {
      const spread = effect.style === 'flame' ? 12 * (1 - age) : 23;
      x = 32 + Math.cos(a + age * 2) * spread * speed;
      y = 49 - age * (15 + 28 * speed);
      if (effect.style === 'beam') alpha *= pulse;
    }
    if (effect.style === 'cloud') {
      dot(x, y, size * 2.1 * (1 - age * .55), 0, alpha);
      dot(x - 1, y - 2, size * 1.35, 1, alpha * .8);
    }
    dot(x, y, size * (1 - age) * .85, i % 3, alpha);
    if (i % 14 === 0 && alpha > .45) {
      dot(x, y, 1, 2, alpha);
      dot(x + 2, y, 1, 1, alpha);
      dot(x, y + 2, 1, 1, alpha);
    }
  }
  ctx.globalAlpha = 1;
}
