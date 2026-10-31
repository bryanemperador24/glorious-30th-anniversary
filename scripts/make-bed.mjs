// Synthesizes a soft, emotional placeholder music bed: a slow I–V–vi–IV progression in D
// (warm pad + gentle piano arpeggio + reverb), 48 kHz stereo WAV. Swap for a licensed track later.
// Usage: node scripts/make-bed.mjs [seconds] [out.wav]
import fs from "node:fs";

const SR = 48000;
const secs = Number(process.argv[2] ?? 70);
const outFile = process.argv[3] ?? "public/anniversary/music/emotional-bed.wav";
const n = Math.round(secs * SR);
const L = new Float32Array(n), R = new Float32Array(n);

const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);
const BEAT = 60 / 72;
const BAR = BEAT * 4;
const CHORDS = [
  [50, 57, 62, 66, 69], // D
  [49, 57, 61, 64, 69], // A/C#
  [47, 54, 59, 62, 66], // Bm
  [43, 50, 55, 59, 62], // G
];
const ARP = [2, 3, 4, 3]; // chord tones the piano walks through each bar

const add = (start, dur, fn, pan = 0) => {
  const a = Math.round(start * SR), b = Math.min(n, Math.round((start + dur) * SR));
  const gl = Math.cos(((pan + 1) * Math.PI) / 4), gr = Math.sin(((pan + 1) * Math.PI) / 4);
  for (let i = Math.max(0, a); i < b; i++) {
    const v = fn((i - a) / SR);
    L[i] += v * gl; R[i] += v * gr;
  }
};

// Felt-piano-ish tone: few harmonics, the upper ones dying faster, soft attack.
const piano = (f, vel) => (t) => {
  let v = 0;
  for (let k = 1; k <= 5; k++) v += (Math.sin(2 * Math.PI * f * k * t) / k ** 1.6) * Math.exp(-t * (0.9 + 0.9 * k));
  return v * vel * Math.min(1, t / 0.006);
};

// Pad: two slightly detuned sines per note, slow swell in and out.
const pad = (f, dur) => (t) => {
  const env = Math.min(1, t / 1.4) * Math.min(1, Math.max(0, (dur - t) / 1.6));
  return (Math.sin(2 * Math.PI * f * t) + Math.sin(2 * Math.PI * (f * 1.003) * t + 1.3)) * 0.5 * env;
};

for (let bar = 0, t = 0; t < secs; bar++, t += BAR) {
  const chord = CHORDS[bar % CHORDS.length];
  chord.slice(0, 4).forEach((m, j) => add(t, BAR + 1.8, pad(hz(m), BAR + 1.8), [-0.5, 0.4, -0.2, 0.5][j]));
  add(t, BAR + 1.5, (x) => pad(hz(chord[0] - 12), BAR + 1.5)(x) * 0.6); // sub
  if (bar === 0) continue; // the first bar is pad only
  ARP.forEach((idx, k) => {
    const vel = k === 0 ? 0.55 : 0.38;
    add(t + k * BEAT, 4, piano(hz(chord[idx] + 12), vel), k % 2 ? 0.25 : -0.25);
  });
}

// Simple Schroeder reverb: parallel damped combs, then allpasses; slightly different per side.
const reverb = (x, offs) => {
  const out = new Float32Array(n);
  for (const d0 of [1687, 1601, 2053, 2251]) {
    const d = d0 + offs, buf = new Float32Array(d);
    let p = 0, lp = 0;
    for (let i = 0; i < n; i++) {
      const y = buf[p];
      lp = y * 0.6 + lp * 0.4;
      buf[p] = x[i] + lp * 0.86;
      out[i] += y * 0.25;
      p = (p + 1) % d;
    }
  }
  for (const d0 of [556, 441]) {
    const d = d0 + offs, buf = new Float32Array(d);
    let p = 0;
    for (let i = 0; i < n; i++) {
      const b = buf[p], y = -out[i] + b;
      buf[p] = out[i] + b * 0.5;
      out[i] = y;
      p = (p + 1) % d;
    }
  }
  return out;
};
const wl = reverb(L, 0), wr = reverb(R, 23);

const buf = Buffer.alloc(44 + n * 4);
buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write("WAVE", 8);
buf.write("fmt ", 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
buf.write("data", 36); buf.writeUInt32LE(n * 4, 40);
const mixL = new Float32Array(n), mixR = new Float32Array(n);
let peak = 1e-9;
for (let i = 0; i < n; i++) {
  const fade = Math.min(1, i / (SR * 3)); // 3s fade-in
  mixL[i] = (L[i] * 0.7 + wl[i] * 0.55) * fade;
  mixR[i] = (R[i] * 0.7 + wr[i] * 0.55) * fade;
  peak = Math.max(peak, Math.abs(mixL[i]), Math.abs(mixR[i]));
}
const g = 0.89 / peak;
for (let i = 0; i < n; i++) {
  buf.writeInt16LE(Math.round(mixL[i] * g * 32767), 44 + i * 4);
  buf.writeInt16LE(Math.round(mixR[i] * g * 32767), 46 + i * 4);
}
fs.writeFileSync(outFile, buf);
console.log(`${outFile}  ${secs}s`);
