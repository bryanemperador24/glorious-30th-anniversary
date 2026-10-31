import React from "react";
import { AbsoluteFill, Html5Audio, OffthreadVideo, Sequence, interpolate, useCurrentFrame } from "remotion";
import { Grain, Letterbox, LETTERBOX, Vignette, asset } from "./effects";
import { Beat, HANDLE_IN, HANDLE_OUT, Subtitle } from "./InterviewFilm";
import { SERIF } from "./PosterReveal";
import linesJson from "./trailer-dito.json";

// Script option 6 ("Dito"), interview cut only: the view changes about every 2 seconds between the
// two cameras (or a very different shot size where there is one camera), alternating with moving B&W shots,
// with the key words set beside each speaker over a soft music bed.
const FPS = 30;
type Line = Beat & { angle?: { file: string; offset: number }; keys: [number, string][] };
const lines = linesJson as unknown as Line[];

const INTRO_BLACK = 15;
const INTRO_FADE = 20;
const TAIL = 45; // black after the last word while the music fades
const SEGMENT = 60; // ~2s per view
const MUSIC_VOLUME = 0.12; // bed sits ~18 dB under the dialogue

// Where each speaker's head sits in each camera, in 1920x1080 proxy pixels (centre, head height).
const FACES: Record<string, { x: number; y: number; h: number }> = {
  "sisa interview.MOV": { x: 915, y: 190, h: 200 },
  "pastor ver interview.MOV": { x: 795, y: 115, h: 165 },
  "Mafil 2.MOV": { x: 960, y: 262, h: 150 },
  "Mafil.MOV": { x: 960, y: 240, h: 200 },
  "Ben 2.MOV": { x: 1055, y: 245, h: 205 },
  "Ben.MOV": { x: 967, y: 190, h: 256 },
  "argi interview.MOV": { x: 925, y: 300, h: 205 },
  "Argi.MOV": { x: 1080, y: 210, h: 270 },
};

// Which side of frame each speaker sits on per line (-1 left, 1 right); the key words go opposite.
const SIDES = [-1, 1, 1, -1, -1, 1, -1, 1, -1, -1, 1, -1];

// Shot sizes, as in a documentary interview: medium, medium close-up and close-up.
type Size = "M" | "MCU" | "CU";
type View = { cam: "a" | "b"; size: Size; bw: boolean };

// Each line cuts between the two angles every ~2s and alternates colour → B&W on every cut, so a shot
// only turns B&W when the angle changes too. With one camera, the "other angle" is a very different
// shot size of the same take. Colour shots are locked off; B&W shots move like a handheld second camera.
const START: Record<string, Size> = { d05: "M", d07: "MCU", d09: "CU", d12: "MCU" };
const planFor = (line: Line, k: number): View => {
  const bw = k % 2 === 1;
  if (line.angle) return [
    { cam: "a", size: "M", bw },
    { cam: "b", size: "MCU", bw },
    { cam: "a", size: "CU", bw },
    { cam: "b", size: "M", bw },
  ][k % 4] as View;
  const first = START[line.id] ?? "M";
  const other: Size = first === "CU" ? "M" : "CU";
  const sizes: Size[] = [first, other, first === "MCU" ? "M" : "MCU", other];
  return { cam: "a", size: sizes[k % 4], bw };
};

const timeline = (() => {
  let cursor = INTRO_BLACK;
  return lines.map((line, i) => {
    const clipStart = Math.max(0, line.in - HANDLE_IN);
    const frames = Math.round((line.out + HANDLE_OUT - clipStart) * FPS);
    const count = Math.max(1, Math.round(frames / SEGMENT));
    const segments = Array.from({ length: count }, (_, k) => {
      const a = Math.round((k * frames) / count), b = Math.round(((k + 1) * frames) / count);
      return { from: a, frames: b - a, view: planFor(line, k) };
    });
    const entry = { line, from: cursor, frames, clipStart, side: SIDES[i % SIDES.length], segments };
    cursor += frames;
    return entry;
  });
})();
const lastEnd = timeline[timeline.length - 1].from + timeline[timeline.length - 1].frames;
export const TRAILER_DITO_FRAMES = lastEnd + TAIL;

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const TOP = LETTERBOX, BOTTOM = 1080 - LETTERBOX;

// Place the frame for a shot size. Every size keeps the whole head below the top bar (the head top is
// estimated with a safety margin); the close-up just has the least headroom. Edges never show.
const frameShot = (face: { x: number; y: number; h: number }, size: Size, push: number, side: number, dx: number, dy: number) => {
  const base = size === "M" ? 1.1 : size === "MCU" ? 1.35 : Math.min(1.7, Math.max(1.55, 400 / face.h));
  const z = base * push;
  const headTop = face.y - 0.6 * face.h;
  const ty0 = TOP + (size === "M" ? 60 : size === "MCU" ? 38 : 22) - headTop * z;
  const tx0 = 960 + side * (size === "CU" ? 260 : 300) - face.x * z;
  const tx = Math.min(0, Math.max(1920 - 1920 * z, tx0 + dx));
  const ty = Math.min(TOP, Math.max(BOTTOM - 1080 * z, ty0 + dy));
  return `translate(${tx}px, ${ty}px) scale(${z})`;
};

const Shot: React.FC<{ id: string; file: string; view: View; side: number; startFrom: number; frames: number }> = ({ id, file, view, side, startFrom, frames }) => {
  const f = useCurrentFrame();
  const p = f / frames;
  // B&W only: slow push, a drift across, and a little handheld sway.
  const push = view.bw ? interpolate(p, [0, 1], [1, 1.06]) : 1;
  const dx = view.bw ? interpolate(p, [0, 1], [36, -36]) * side + 7 * Math.sin(f * 0.13) + 4 * Math.sin(f * 0.31 + 1) : 0;
  const dy = view.bw ? 4 + 3 * Math.sin(f * 0.17 + 2) + 2 * Math.sin(f * 0.41) : 0;
  const filter = view.bw
    ? "grayscale(1) contrast(1.22) brightness(0.95)"
    : "contrast(1.08) brightness(0.97) saturate(0.68) sepia(0.12)";
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <OffthreadVideo
        muted
        src={asset(`clips/${id}.mp4`)}
        startFrom={startFrom}
        style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, transformOrigin: "0 0", transform: frameShot(FACES[file], view.size, push, side, dx, dy), filter }}
      />
      <Grain frame={f} opacity={view.bw ? 0.42 : 0.16} id={`grain-${id}-${startFrom}`} />
      <Vignette strength={view.bw ? 0.7 : 0.5} />
    </AbsoluteFill>
  );
};

// One key word or phrase: letters rise and sharpen in one after another. It holds its place in the
// column from the start of the line (hidden), so a later phrase never pushes an earlier one.
const KeyWord: React.FC<{ text: string; at: number; big: boolean }> = ({ text, at, big }) => {
  const f = useCurrentFrame() - at;
  let n = 0;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", columnGap: "0.4em", fontSize: big ? 62 : 54, lineHeight: 1.12 }}>
      {text.split(" ").map((word, w) => (
        <span key={w} style={{ whiteSpace: "nowrap" }}>
          {[...word].map((ch, c) => {
            const d = f - n++ * 1.4;
            return (
              <span
                key={c}
                style={{
                  display: "inline-block",
                  opacity: interpolate(d, [0, 10], [0, 1], clamp),
                  transform: `translateY(${interpolate(d, [0, 14], [16, 0], clamp)}px)`,
                  filter: `blur(${interpolate(d, [0, 12], [6, 0], clamp)}px)`,
                }}
              >
                {ch}
              </span>
            );
          })}
        </span>
      ))}
    </div>
  );
};

// The key words of one line, stacked in a column on the side away from the speaker, drifting slowly.
const KeyWords: React.FC<{ keys: { at: number; text: string }[]; end: number; side: number }> = ({ keys, end, side }) => {
  const f = useCurrentFrame();
  const drift = interpolate(f, [0, end], [0, -10]);
  return (
    <div
      style={{
        position: "absolute",
        left: side < 0 ? 100 : 1920 - 100 - 620,
        width: 620,
        top: TOP,
        bottom: LETTERBOX,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 22,
        fontFamily: SERIF,
        letterSpacing: "0.14em",
        color: "#F4E7CF",
        textShadow: "0 2px 18px rgba(0,0,0,0.75)",
        opacity: interpolate(f, [end - 10, end], [1, 0], clamp),
        transform: `translate(${side * drift * -0.6}px, ${drift}px)`,
      }}
    >
      {keys.map((k, i) => (
        <KeyWord key={i} text={k.text} at={k.at} big={i > 0} />
      ))}
    </div>
  );
};

const LineView: React.FC<{ t: (typeof timeline)[number]; isFirst: boolean }> = ({ t, isFirst }) => {
  const f = useCurrentFrame();
  const { line, frames, clipStart, side, segments } = t;
  const sec = clipStart + f / FPS;
  const sub = [...line.subs].reverse().find(([s]) => sec >= s - 0.05);
  const fadeUp = isFirst ? interpolate(f, [0, INTRO_FADE], [0, 1], clamp) : 1;
  const keyFrame = (s: number) => Math.round((s - clipStart) * FPS);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ opacity: fadeUp }}>
        {segments.map((s, k) => (
          <Sequence key={k} from={s.from} durationInFrames={s.frames} layout="none">
            <Shot
              id={s.view.cam === "b" ? `${line.id}b` : line.id}
              file={s.view.cam === "b" ? line.angle!.file : line.file}
              view={s.view}
              side={side}
              startFrom={s.from}
              frames={s.frames}
            />
          </Sequence>
        ))}
        <KeyWords keys={line.keys.map(([s, text]) => ({ at: keyFrame(s), text }))} end={frames} side={-side} />
      </AbsoluteFill>
      {sub && sec <= line.out + 0.2 ? <Subtitle text={sub[1]} /> : null}
      <Html5Audio
        src={asset(`clips/${line.id}.mp4`)}
        volume={(v) => interpolate(v, [0, 3, frames - 4, frames], [0, 1, 1, 0], clamp) * (isFirst ? interpolate(v, [0, INTRO_FADE], [0, 1], clamp) : 1)}
      />
    </AbsoluteFill>
  );
};

export const TrailerDito: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {timeline.map((t, i) => (
        <Sequence key={t.line.id} from={t.from} durationInFrames={t.frames} name={`${t.line.id} ${t.line.act}`}>
          <LineView t={t} isFirst={i === 0} />
        </Sequence>
      ))}
      <Letterbox open={1} />
      <Html5Audio
        src={asset("music/emotional-bed.wav")}
        volume={(f) => MUSIC_VOLUME * interpolate(f, [lastEnd - 10, TRAILER_DITO_FRAMES - 2], [1, 0], clamp)}
      />
    </AbsoluteFill>
  );
};
