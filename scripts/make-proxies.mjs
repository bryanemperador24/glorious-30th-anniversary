// Cuts each beat from the 4K interview footage into a 1080p H.264 clip for Remotion:
// tone-maps iPhone HLG to SDR, cleans up and levels the dialogue. Skips clips already made.
// Usage: node scripts/make-proxies.mjs [--beats=src/anniversary/beats.json] [--force]
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export const HANDLE_IN = 0.15;
export const HANDLE_OUT = 0.35;

const beatsFile = process.argv.find((a) => a.startsWith("--beats="))?.slice(8) ?? "src/anniversary/beats.json";
const beats = JSON.parse(fs.readFileSync(beatsFile, "utf8"));
const footage = "30th-anniversary/footage/interviews";
const outDir = "public/anniversary/clips";
const force = process.argv.includes("--force");
fs.mkdirSync(outDir, { recursive: true });

const TONEMAP =
  "zscale=t=linear:npl=203,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=mobius:param=0.4:desat=0,zscale=t=bt709:m=bt709:r=tv";

// A beat with an `angle` also gets <id>b.mp4: the same moment from the second camera, shifted by its sync offset.
const jobs = beats.flatMap((b) => [
  { id: b.id, file: b.file, in: b.in, out: b.out },
  ...(b.angle ? [{ id: `${b.id}b`, file: b.angle.file, in: b.in + b.angle.offset, out: b.out + b.angle.offset }] : []),
]);

for (const b of jobs) {
  const out = path.join(outDir, `${b.id}.mp4`);
  if (!force && fs.existsSync(out)) continue;
  const src = path.join(footage, b.file);
  const transfer = execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=color_transfer", "-of", "csv=p=0", src]).toString().trim();
  const vf = ["scale=1920:1080", transfer === "arib-std-b67" ? TONEMAP : null, "format=yuv420p"].filter(Boolean).join(",");
  const start = Math.max(0, b.in - HANDLE_IN);
  execFileSync("ffmpeg", [
    "-y", "-v", "error", "-ss", String(start), "-i", src, "-t", String(b.out + HANDLE_OUT - start),
    "-vf", vf, "-c:v", "libx264", "-crf", "18", "-preset", "medium", "-r", "30",
    "-af", "highpass=f=80,afftdn=nf=-25,loudnorm=I=-18:TP=-2:LRA=9", "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
    out,
  ]);
  console.log(`${b.id} done`);
}
