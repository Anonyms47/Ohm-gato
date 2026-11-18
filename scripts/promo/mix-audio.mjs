// Bande son de la vidéo de présentation : sons des messages + voix off, mixés sur la vidéo muette.
// Voix : synthèse locale Piper (voix française « siwis »). Prérequis : `piper` et le modèle .onnx.
// Usage : PIPER=/chemin/piper VOICE=/chemin/fr_FR-siwis-medium.onnx node scripts/promo/mix-audio.mjs [entrée.mp4] [sortie.mp4]
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const input = path.resolve(process.argv[2] ?? path.join(ROOT, "docs/animations/ohmegato-presentation-1920x1080-60fps.mp4"));
const output = path.resolve(process.argv[3] ?? path.join(ROOT, "docs/animations/ohmegato-presentation-son-1920x1080-60fps.mp4"));
const PIPER = process.env.PIPER ?? "piper";
const VOICE = process.env.VOICE;
if (!VOICE) throw new Error("VOICE : chemin du modèle Piper (.onnx) requis");

// Sons des messages (instants d'apparition des bulles dans la vidéo)
const received = [1.54, 6.49];
const sent = [3.44];
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

// carillon doux à deux notes (message reçu) et léger souffle (message envoyé) : sons originaux
const ding = path.join(dir, "ding.wav");
ff("-f", "lavfi", "-i", "aevalsrc=0.45*sin(2*PI*1046.5*t)*exp(-7*t)+0.12*sin(2*PI*2093*t)*exp(-11*t):s=48000:d=0.7",
  "-f", "lavfi", "-i", "aevalsrc=0.4*sin(2*PI*1568*t)*exp(-6*t)+0.1*sin(2*PI*3136*t)*exp(-10*t):s=48000:d=0.8",
  "-filter_complex", "[1]adelay=95|95[b];[0][b]amix=inputs=2:normalize=0,afade=t=in:d=0.004,volume=0.9", "-ac", "2", ding);
const swoosh = path.join(dir, "swoosh.wav");
ff("-f", "lavfi", "-i", "anoisesrc=color=pink:sample_rate=48000:d=0.38:amplitude=0.6",
  "-af", "highpass=f=900,lowpass=f=5200,afade=t=in:d=0.12,afade=t=out:st=0.16:d=0.22,volume=0.35", "-ac", "2", swoosh);

// voix off : synthèse un peu posée, puis chaleur (graves légers), compression douce et très légère pièce
const voice = lines.map(([, text], i) => {
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
received.forEach((t) => add(ding, t, 0.8));
sent.forEach((t) => add(swoosh, t, 0.9));
lines.forEach(([t], i) => add(voice[i], t, 1.0));
const labels = parts.map((_, k) => `[a${k}]`).join("");
const filter = `${parts.join(";")};${labels}amix=inputs=${parts.length}:normalize=0,apad,atrim=0:${duration.toFixed(3)},loudnorm=I=-16:TP=-1.5:LRA=11[mix]`;
const track = path.join(dir, "mix.wav");
ff(...inputs, "-filter_complex", filter, "-map", "[mix]", "-ar", "48000", track);
ff("-i", input, "-i", track, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", output);
fs.rmSync(dir, { recursive: true, force: true });
console.log("vidéo avec son :", output);
