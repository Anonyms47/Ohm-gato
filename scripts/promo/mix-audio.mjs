// Bande son de la vidéo de présentation : sons des bulles de messages (originaux), voix off facultative.
// Sans VOICE : sons des messages seuls. Avec VOICE (modèle Piper .onnx) et PIPER : voix off de synthèse en plus.
// Usage : node scripts/promo/mix-audio.mjs [entrée.mp4] [sortie.mp4]
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const input = path.resolve(process.argv[2] ?? path.join(ROOT, "docs/animations/ohmegato-presentation-1920x1080-60fps.mp4"));
const output = path.resolve(process.argv[3] ?? path.join(ROOT, "docs/animations/ohmegato-presentation-son-1920x1080-60fps.mp4"));
// sons seuls : niveau final adapté à des effets courts (pas de normalisation sur une voix)
const PIPER = process.env.PIPER ?? "piper";
const VOICE = process.env.VOICE;
// musique originale (scripts/promo/musique.py) ; MUSIC=chemin.wav, ou générée automatiquement si python3 et numpy sont présents
const MUSIC = process.env.MUSIC ?? "auto";

// Sons des messages (instants d'apparition des bulles dans la vidéo)
const timings = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts/promo/timings.json"), "utf8"));
const { received, sent } = timings;
// Voix off : chaque phrase démarre sur sa scène (secondes)
const lines = [
  [9.8, "Chez Ohmégato, tout commence par une fournée."],
  [13.3, "Des cookies, des brownies, des moelleux… tout est fait maison, ici, à Dakar."],
  [18.9, "On vous livre dans Dakar… ou vous passez les chercher à Sud Foire."],
  [22.7, "Vous choisissez sur votre téléphone… un geste, et c’est dans votre boîte."],
  [27.4, "Votre commande rejoint la prochaine fournée."],
  [32.4, "Ohmégato. Pâtisseries faites maison."],
  [42.3, "Commandez dès maintenant, sur ohmégato point com."],
];

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "son-"));
const ff = (...args) => execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...args]);
const duration = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", input]).toString());

// sons originaux dans l'esprit d'une messagerie : « swoosh » montant (envoi), « bloop » de bulle (réception)
const ding = path.join(dir, "ding.wav");
ff("-f", "lavfi", "-i", "aevalsrc=0.55*sin(2*PI*(1180*t-1400*t*t))*exp(-22*t)+0.22*sin(2*PI*1760*t)*exp(-14*t)*gt(t\\,0.035):s=48000:d=0.45",
  "-af", "afade=t=in:d=0.003,highpass=f=250,volume=0.9", "-ac", "2", ding);
const swoosh = path.join(dir, "swoosh.wav");
ff("-f", "lavfi", "-i", "aevalsrc=0.35*sin(2*PI*(380*t+2600*t*t))*sin(PI*t/0.24)*lt(t\\,0.24):s=48000:d=0.3",
  "-f", "lavfi", "-i", "anoisesrc=color=pink:sample_rate=48000:d=0.3:amplitude=0.5",
  "-filter_complex", "[1]highpass=f=1500,lowpass=f=7000,afade=t=in:d=0.06,afade=t=out:st=0.08:d=0.16,volume=0.25[n];[0][n]amix=inputs=2:normalize=0,volume=0.9", "-ac", "2", swoosh);

// voix off : synthèse un peu posée, puis chaleur (graves légers), compression douce et très légère pièce
const voice = !VOICE ? [] : lines.map(([, text], i) => {
  const raw = path.join(dir, `v${i}.wav`);
  execFileSync(PIPER, ["-m", VOICE, "--length_scale", "1.06", "--noise_scale", "0.6", "--noise_w", "0.75", "-f", raw], { input: text, stdio: ["pipe", "ignore", "ignore"] });
  const out = path.join(dir, `vp${i}.wav`);
  ff("-i", raw, "-af", "aresample=48000,highpass=f=75,equalizer=f=180:t=q:w=1:g=2,equalizer=f=3200:t=q:w=1.2:g=1.5,acompressor=threshold=-20dB:ratio=2.5:attack=8:release=120,aecho=0.8:0.4:28:0.12", "-ac", "2", out);
  return out;
});

const inputs = [];
const parts = [];
const add = (file, at, gain) => {
  const k = inputs.length / 2;
  inputs.push("-i", file);
  const ms = Math.round(at * 1000);
  parts.push(`[${k}]adelay=${ms}|${ms},volume=${gain}[a${k}]`);
};
received.forEach((t) => add(ding, t, 1.8));
sent.forEach((t) => add(swoosh, t, 2.0));
voice.forEach((file, i) => add(file, lines[i][0], 1.0));
if (MUSIC !== "none") {
  let music = MUSIC;
  if (MUSIC === "auto") {
    music = path.join(dir, "musique.wav");
    execFileSync("python3", [path.join(ROOT, "scripts/promo/musique.py"), music, duration.toFixed(3), path.join(ROOT, "scripts/promo/timings.json")], { stdio: "ignore" });
  }
  // sous les bulles : la musique reste en retrait
  add(music, 0, Number(process.env.MUSIC_GAIN ?? 0.3));
}
const labels = parts.map((_, k) => `[a${k}]`).join("");
const filter = `${parts.join(";")};${labels}amix=inputs=${parts.length}:normalize=0,apad,atrim=0:${duration.toFixed(3)},${VOICE ? "loudnorm=I=-16:TP=-1.5:LRA=11" : "alimiter=limit=0.89"}[mix]`;
const track = path.join(dir, "mix.wav");
ff(...inputs, "-filter_complex", filter, "-map", "[mix]", "-ar", "48000", track);
ff("-i", input, "-i", track, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", output);
fs.rmSync(dir, { recursive: true, force: true });
console.log("vidéo avec son :", output);
