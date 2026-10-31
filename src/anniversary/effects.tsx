import React from "react";
import { AbsoluteFill, Easing, Img, continueRender, delayRender, interpolate, random, staticFile } from "remotion";

export const asset = (name: string) => staticFile(`anniversary/${name}`);
export const GOLD = "#E0C498";
export const SUB_YELLOW = "#F7D046";

// ---------- Fonts ----------
export const OSKARI = "Oskari G2";
const fontHandle = delayRender("Loading Oskari G2");
Promise.all([
  new FontFace(OSKARI, `url(${asset("fonts/oskari-g2-regular.otf")})`, { weight: "400" }).load(),
  new FontFace(OSKARI, `url(${asset("fonts/OskariG2Medium.otf")})`, { weight: "500" }).load(),
])
  .then((faces) => {
    faces.forEach((f) => document.fonts.add(f));
    continueRender(fontHandle);
  })
  .catch((err) => {
    console.error(err);
    continueRender(fontHandle);
  });

// ---------- Silk ----------
// The cloth PNG's ribbon is cut off flat at its left and right ends; feather both ends to nothing.
const FADE_ENDS_MASK = "linear-gradient(90deg, transparent 6%, #000 30%, #000 68%, transparent 91%)";
export const fadeEnds: React.CSSProperties = { WebkitMaskImage: FADE_ENDS_MASK, maskImage: FADE_ENDS_MASK };

// Blurred silk sheets rushing toward the lens, covering a cut. `at` is the cut frame.
export const SilkPass: React.FC<{ frame: number; at: number; dur?: number }> = ({ frame, at, dur = 40 }) => {
  const p = interpolate(frame, [at - dur / 2, at + dur / 2], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  if (p <= 0 || p >= 1) return null;
  const sheets = [
    { src: "cloth-blur.png", x: -500, y: -250, w: 3000, rot: -14, dx: -500, dy: -200 },
    { src: "cloth-blur2.png", x: -300, y: 250, w: 3200, rot: 10, dx: 400, dy: 300 },
    { src: "cloth-blur.png", x: 200, y: -100, w: 2600, rot: 160, dx: 600, dy: -150 },
  ];
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {sheets.map((s, i) => {
        const local = interpolate(p, [i * 0.1, 0.7 + i * 0.1], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.in(Easing.quad) });
        const scale = 0.9 + local * 2.6;
        const opacity = interpolate(local, [0, 0.35, 0.75, 1], [0, 0.95, 0.9, 0]);
        return (
          <Img
            key={i}
            src={asset(s.src)}
            style={{
              position: "absolute",
              left: s.x,
              top: s.y,
              width: s.w,
              opacity,
              filter: "blur(6px)",
              transform: `translate(${s.dx * local}px, ${s.dy * local}px) scale(${scale}) rotate(${s.rot}deg)`,
              ...fadeEnds,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

// ---------- Grain / vignette ----------
export const Grain: React.FC<{ frame: number; opacity?: number; id?: string }> = ({ frame, opacity = 0.22, id = "grain" }) => (
  <svg width="1920" height="1080" style={{ position: "absolute", inset: 0, mixBlendMode: "overlay", opacity, pointerEvents: "none" }}>
    <filter id={id}>
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={frame % 24} stitchTiles="stitch" />
      <feColorMatrix type="saturate" values="0" />
    </filter>
    <rect width="100%" height="100%" filter={`url(#${id})`} />
  </svg>
);

export const Vignette: React.FC<{ strength?: number }> = ({ strength = 0.55 }) => (
  <AbsoluteFill style={{ background: `radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,${strength}) 100%)`, pointerEvents: "none" }} />
);

// ---------- Letterbox (2.39:1) ----------
export const LETTERBOX = Math.round((1080 - 1920 / 2.39) / 2); // 138px
export const Letterbox: React.FC<{ open?: number }> = ({ open = 1 }) => {
  const h = LETTERBOX * open;
  if (h <= 0) return null;
  const bar: React.CSSProperties = { position: "absolute", left: 0, right: 0, height: h, background: "#000" };
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ ...bar, top: 0 }} />
      <div style={{ ...bar, bottom: 0 }} />
    </AbsoluteFill>
  );
};

// ---------- Gold glitter ----------
type Box = { x: number; y: number; w: number; h: number };
const GLITTER_COLORS = ["#FFF6DD", "#F6DC9A", "#E8C077", "#FFE7A6", "#D9A957"];

// Deterministic gold particles. "area" spawns anywhere in the box over the window;
// "sweep" spawns along a vertical line that travels left → right across the box.
export const GoldGlitter: React.FC<{
  frame: number;
  start: number;
  duration: number;
  box: Box;
  count: number;
  seed: string;
  mode?: "area" | "sweep";
  life?: number;
  size?: [number, number];
  rise?: number; // upward drift in px/frame
  tempo?: number; // < 1 slows the twinkle, drift and lifetime
}> = ({ frame, start, duration, box, count, seed, mode = "area", life = 45, size = [2, 7], rise = 0.6, tempo = 1 }) => {
  if (frame < start || frame > start + duration + (life / tempo) * 1.4) return null;
  const particles: React.ReactNode[] = [];
  for (let i = 0; i < count; i++) {
    const r = (k: string) => random(`${seed}-${i}-${k}`);
    const born = start + r("t") * duration;
    const myLife = (life / tempo) * (0.6 + r("l") * 0.8);
    const age = frame - born;
    if (age < 0 || age > myLife) continue;
    const t = age / myLife;
    const spawnX = mode === "sweep" ? box.x + ((born - start) / duration) * box.w + (r("j") - 0.5) * 60 : box.x + r("x") * box.w;
    const x = spawnX + (r("vx") - 0.5) * 1.2 * age * tempo;
    const y = box.y + r("y") * box.h - rise * (0.4 + r("vy")) * age * tempo;
    const twinkle = 0.55 + 0.45 * Math.sin(age * tempo * (0.35 + r("f") * 0.5) + r("p") * 6.28);
    const opacity = Math.sin(Math.PI * t) * twinkle;
    const s = size[0] + r("s") * (size[1] - size[0]);
    const color = GLITTER_COLORS[Math.floor(r("c") * GLITTER_COLORS.length)];
    const star = r("star") < 0.12;
    particles.push(
      star ? (
        <div key={i} style={{ position: "absolute", left: x, top: y, opacity, transform: `translate(-50%,-50%) rotate(${age * 2 * tempo}deg) scale(${0.6 + twinkle * 0.8})` }}>
          <div style={{ position: "absolute", width: s * 7, height: 2, left: -s * 3.5, top: -1, background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
          <div style={{ position: "absolute", width: 2, height: s * 7, left: -1, top: -s * 3.5, background: `linear-gradient(0deg, transparent, ${color}, transparent)` }} />
          <div style={{ position: "absolute", width: s, height: s, left: -s / 2, top: -s / 2, borderRadius: "50%", background: "#fff", boxShadow: `0 0 ${s * 3}px ${color}` }} />
        </div>
      ) : (
        <div
          key={i}
          style={{
            position: "absolute",
            left: x - s / 2,
            top: y - s / 2,
            width: s,
            height: s,
            borderRadius: "50%",
            opacity,
            background: `radial-gradient(circle, #fff 0%, ${color} 45%, transparent 75%)`,
            boxShadow: `0 0 ${s * 2.5}px ${color}`,
          }}
        />
      ),
    );
  }
  return <AbsoluteFill style={{ mixBlendMode: "screen", pointerEvents: "none" }}>{particles}</AbsoluteFill>;
};
