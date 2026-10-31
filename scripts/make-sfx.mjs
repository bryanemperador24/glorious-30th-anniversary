// Synthesizes placeholder trailer sound effects (48 kHz stereo WAV) for the poster animation.
// Usage: node scripts/make-sfx.mjs <outDir>
// Swap any of these for library SFX with the same file name.
import fs from "node:fs";
import path from "node:path";

const SR = 48000;
const outDir = process.argv[2] ?? "public/anniversary/sfx";
fs.mkdirSync(outDir, { recursive: true });

// Seeded noise so the files are reproducible.
let seed = 1;
const noise = () => {
  seed = (seed * 16807) % 2147483647;
  return (seed / 2147483647) * 2 - 1;
};

// State-variable bandpass, cutoff can change per sample.
const svf = () => {
  let low = 0, band = 0;
  return (x, cutoff, q = 0.7) => {
    const f = 2 * Math.sin((Math.PI * Math.min(cutoff, SR / 6)) / SR);
    low += f * band;
    const high = x - low - q * band;
    band += f * high;
    return { low, band, high };
  };
};

const writeWav = (name, left, right) => {
  const n = left.length;
  const buf = Buffer.alloc(44 + n * 4);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write("WAVE", 8);
  buf.write("fmt ", 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
  buf.write("data", 36); buf.writeUInt32LE(n * 4, 40);
  let peak = 1e-9;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
  const gain = 0.89 / peak; // normalize to about -1 dBFS
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, left[i] * gain)) * 32767), 44 + i * 4);
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, right[i] * gain)) * 32767), 46 + i * 4);
  }
  fs.writeFileSync(path.join(outDir, `${name}.wav`), buf);
  console.log(`${name}.wav  ${(n / SR).toFixed(2)}s`);
};

const make = (secs, fn) => {
  const n = Math.round(secs * SR);
  const L = new Float32Array(n), R = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const [l, r] = fn(i / SR, i / n);
    L[i] = l; R[i] = r;
  }
  return [Array.from(L), Array.from(R)];
};

// Whoosh: band-passed noise sweeping up then down, panning left → right,
// with a low "body" layer (low-passed noise + a sub sine that bends with the sweep) for weight.
const whoosh = (secs, lo, hi, peakAt = 0.55, weight = 0) => {
  const air = svf();
  const body = svf();
  let phase = 0;
  return make(secs, (t, p) => {
    const sweep = p < peakAt ? p / peakAt : 1 - (p - peakAt) / (1 - peakAt);
    const env = Math.pow(Math.sin(Math.PI * Math.min(1, p / (peakAt * 2))), 2) * (p < peakAt ? 1 : Math.pow(1 - (p - peakAt) / (1 - peakAt), 1.5));
    const top = air(noise(), lo + (hi - lo) * sweep, 0.5).band;
    phase += (2 * Math.PI * (45 + 55 * sweep)) / SR;
    const low = (body(noise(), 140 + 220 * sweep, 0.8).low * 1.6 + Math.sin(phase) * 0.35) * weight;
    const s = (top + low) * env;
    const pan = 0.2 + 0.6 * p;
    return [s * Math.cos((pan * Math.PI) / 2), s * Math.sin((pan * Math.PI) / 2)];
  });
};

// Impact: pitch-dropping sub sine + click + dark noise tail.
const impact = (secs, f0, f1, tail = 0.6) => {
  const f = svf();
  let phase = 0;
  return make(secs, (t) => {
    const freq = f1 + (f0 - f1) * Math.exp(-t * 18);
    phase += (2 * Math.PI * freq) / SR;
    const sub = Math.sin(phase) * Math.exp(-t * (2.2 / secs) * 2.5);
    const click = noise() * Math.exp(-t * 90) * 0.8;
    const rumble = f(noise(), 180, 0.9).low * Math.exp(-t * 5) * tail;
    const s = sub + click + rumble;
    return [s, s];
  });
};

// Riser: noise + tone climbing in pitch and level, ending abruptly.
const riser = (secs) => {
  const f = svf();
  let phase = 0;
  return make(secs, (t, p) => {
    const env = Math.pow(p, 2.2) * (p > 0.985 ? (1 - p) / 0.015 : 1);
    phase += (2 * Math.PI * (120 + 900 * p * p)) / SR;
    const s = (f(noise(), 300 + 7000 * p * p, 0.4).band * 0.9 + Math.sin(phase) * 0.25) * env;
    const w = Math.sin(t * 2 * Math.PI * (2 + 10 * p)) * 0.3 * p;
    return [s * (1 + w), s * (1 - w)];
  });
};

// Shimmer: random high bell partials, for the gold glitter.
const shimmer = (secs) => {
  const bells = Array.from({ length: 40 }, () => ({ at: Math.abs(noise()) * secs * 0.8, f: 2500 + Math.abs(noise()) * 5000, pan: Math.abs(noise()) }));
  return make(secs, (t, p) => {
    let l = 0, r = 0;
    for (const b of bells) {
      const d = t - b.at;
      if (d < 0) continue;
      const v = Math.sin(2 * Math.PI * b.f * d) * Math.exp(-d * 9) * 0.25;
      l += v * (1 - b.pan); r += v * b.pan;
    }
    const fade = 1 - Math.pow(p, 3);
    return [l * fade, r * fade];
  });
};

// Shine: a soft airy swell with a few high bell partials, for a light sweeping across gold.
const shine = (secs) => {
  const air = svf();
  const partials = [2093, 3136, 4186, 5274];
  return make(secs, (t, p) => {
    const env = Math.pow(Math.min(1, p / 0.35), 1.5) * Math.pow(1 - Math.max(0, (p - 0.35) / 0.65), 2);
    const hiss = air(noise(), 5000 + 3000 * p, 0.6).band * 0.5;
    let tone = 0;
    partials.forEach((f, i) => (tone += Math.sin(2 * Math.PI * f * t * (1 + 0.002 * Math.sin(t * 6 + i))) * (0.22 / (i + 1))));
    const s = (hiss + tone) * env;
    const pan = 0.25 + 0.5 * p;
    return [s * Math.cos((pan * Math.PI) / 2), s * Math.sin((pan * Math.PI) / 2)];
  });
};

writeWav("shine", ...shine(1.8));
writeWav("whoosh-soft", ...whoosh(1.6, 110, 1400, 0.6, 1));
writeWav("whoosh-fast", ...whoosh(0.75, 150, 2800, 0.45, 1.1));
writeWav("whoosh-zoom", ...whoosh(1.2, 90, 3500, 0.75, 1.2));
writeWav("hit", ...impact(1.6, 140, 42, 0.5));
writeWav("boom", ...impact(3.2, 110, 32, 0.9));
writeWav("riser", ...riser(1.6));
writeWav("shimmer", ...shimmer(2.2));
