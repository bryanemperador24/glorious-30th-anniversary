// Renders selected frames of a composition as stills and tiles them into a labelled storyboard sheet.
// Usage: node scripts/storyboard.mjs <compositionId> <out.jpg> <frame:label> [frame:label ...]
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const [id, out, ...shots] = process.argv.slice(2);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "storyboard-"));
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const composition = await selectComposition({ serveUrl, id });

const tiles = [];
for (const [i, shot] of shots.entries()) {
  const [frame, label] = shot.split(/:(.*)/s);
  const still = path.join(tmp, `${i}.png`);
  await renderStill({ serveUrl, composition, frame: Number(frame), output: still });
  const secs = (Number(frame) / composition.fps).toFixed(1);
  const tile = path.join(tmp, `t${i}.png`);
  const caption = `${i + 1}   ${secs}s   ${label}`.replace(/[:']/g, "");
  execFileSync("ffmpeg", [
    "-y", "-v", "error", "-i", still,
    "-vf", `scale=640:360,pad=640:410:0:0:color=0x111111,drawtext=fontfile=/System/Library/Fonts/Helvetica.ttc:text='${caption}':fontcolor=white:fontsize=17:x=12:y=372`,
    tile,
  ]);
  tiles.push(tile);
  console.log(`frame ${frame} done`);
}

const cols = 3;
const layout = tiles.map((_, i) => `${(i % cols) * 650}_${Math.floor(i / cols) * 420}`).join("|");
execFileSync("ffmpeg", [
  "-y", "-v", "error",
  ...tiles.flatMap((t) => ["-i", t]),
  "-filter_complex", `${tiles.map((_, i) => `[${i}]`).join("")}xstack=inputs=${tiles.length}:layout=${layout}:fill=0x222222`,
  "-q:v", "3", out,
]);
console.log(`Storyboard written to ${out}`);
