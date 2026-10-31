// Builds a storyboard sheet from video clips: one frame per shot, with a gold heading and caption lines.
// Usage: node scripts/clip-board.mjs <shots.json> <out.jpg>
// shots.json: [{ "file": "path.mov" | "image.png", "t": seconds, "head": "ACT", "lines": ["...", "..."],
//                "look": { "bw": true, "grain": 0-40, "zoom": 1.5, "sub": "subtitle text" } }]
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const [shotsFile, out] = process.argv.slice(2);
const shots = JSON.parse(fs.readFileSync(shotsFile, "utf8"));
const base = path.dirname(path.resolve(shotsFile));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "clipboard-"));
const FONT = "/System/Library/Fonts/Helvetica.ttc";
const SUB_FONT = "/System/Library/Fonts/HelveticaNeue.ttc";
const W = 480, H = 270, CAP = 112, COLS = 4;

// Look applied at 1080p before the frame is shrunk into its tile.
const lookFilters = (look, i) => {
  if (!look) return [];
  const f = [];
  const z = look.zoom ?? 1;
  // Punch-in: crop toward the upper-middle where faces sit.
  if (z > 1) f.push(`crop=iw/${z}:ih/${z}:(iw-iw/${z})/2:(ih-ih/${z})*0.3`);
  f.push("scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080");
  f.push(
    look.bw
      ? "hue=s=0,eq=contrast=1.22:brightness=-0.05"
      : "eq=contrast=1.08:brightness=-0.04:saturation=0.8,colorbalance=rs=0.05:gs=0.01:bs=-0.05:rm=0.03:bm=-0.04",
  );
  if (look.grain) f.push(`noise=alls=${look.grain}:allf=t+u`);
  f.push("vignette=angle=PI/4.5");
  if (look.sub) {
    const sub = path.join(tmp, `s${i}.txt`);
    fs.writeFileSync(sub, look.sub);
    f.push(
      `drawtext=fontfile=${SUB_FONT}:textfile=${sub}:text_align=C:fontcolor=0xF7D046:fontsize=46:line_spacing=10` +
        ":shadowcolor=black@0.75:shadowx=2:shadowy=2:x=(w-tw)/2:y=h-th-80",
    );
  }
  return f;
};

const lookTag = (look) =>
  !look ? "" : [look.bw ? "B&W" : "COLOR", look.grain >= 20 ? "HEAVY GRAIN" : look.grain ? "light grain" : null, look.zoom > 1 ? `PUNCH-IN ${look.zoom}x` : "wide"]
    .filter(Boolean)
    .join(" / ");

const tiles = shots.map((s, i) => {
  const head = path.join(tmp, `h${i}.txt`);
  const body = path.join(tmp, `b${i}.txt`);
  fs.writeFileSync(head, `${i + 1}  ${s.head}`);
  fs.writeFileSync(body, [...s.lines, lookTag(s.look)].filter(Boolean).join("\n"));
  const tile = path.join(tmp, `t${i}.png`);
  const input = path.resolve(base, s.file);
  const seek = s.t != null ? ["-ss", String(s.t)] : [];
  execFileSync("ffmpeg", [
    "-y", "-v", "error", ...seek, "-i", input, "-frames:v", "1",
    "-vf", [
      ...lookFilters(s.look, i),
      `scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2`,
      `pad=${W}:${H + CAP}:0:0:color=0x111111`,
      `drawtext=fontfile=${FONT}:textfile=${head}:fontcolor=0xE0C498:fontsize=15:x=10:y=${H + 8}`,
      `drawtext=fontfile=${FONT}:textfile=${body}:fontcolor=white:fontsize=13:line_spacing=5:x=10:y=${H + 30}`,
    ].join(","),
    tile,
  ]);
  return tile;
});

const layout = tiles.map((_, i) => `${(i % COLS) * (W + 8)}_${Math.floor(i / COLS) * (H + CAP + 8)}`).join("|");
execFileSync("ffmpeg", [
  "-y", "-v", "error",
  ...tiles.flatMap((t) => ["-i", t]),
  "-filter_complex", `${tiles.map((_, i) => `[${i}]`).join("")}xstack=inputs=${tiles.length}:layout=${layout}:fill=0x222222`,
  "-q:v", "3", out,
]);
console.log(`Storyboard written to ${out}`);
