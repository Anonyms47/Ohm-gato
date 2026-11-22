"""Musique originale de la vidéo de présentation OHMEGATO (entièrement synthétisée, sans échantillon externe).

Calée sur le montage : intro feutrée pendant les messages, ouverture au moment où la bulle devient le site,
groove chaleureux pendant la visite, énergie sur la partie téléphone, suspension pendant que le logo s'écrit,
résolution sur le bouton « Commander ».

Usage : python3 scripts/promo/musique.py sortie.wav [durée_s] [timings.json]   (nécessite numpy)
"""

import json
import sys
import wave

import numpy as np

SR = 48000
OUT = sys.argv[1] if len(sys.argv) > 1 else "musique.wav"
DUR = float(sys.argv[2]) if len(sys.argv) > 2 else 46.9
rng = np.random.default_rng(7)

# repères du montage (secondes)
DROP = 9.09  # la bulle devient le site
PHONE = 21.29  # partie téléphone
BRAND = 30.79  # plein écran, le logo s'écrit
FINAL = 41.59  # bouton « Commander »
if len(sys.argv) > 3:
    with open(sys.argv[3], encoding="utf-8") as f:
        _t = json.load(f)
    DROP, PHONE, BRAND, FINAL = _t["drop"], _t["phone"], _t["brand"], _t["final"]

BPM = 96.0
BEAT = 60.0 / BPM
BAR = 4 * BEAT

n_total = int(DUR * SR) + SR
L = np.zeros(n_total)
R = np.zeros(n_total)


def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def add(sig, at, pan=0.0, gain=1.0):
    i = int(at * SR)
    if i >= n_total:
        return
    sig = sig[: n_total - i] * gain
    L[i : i + len(sig)] += sig * np.sqrt(0.5 * (1 - pan))
    R[i : i + len(sig)] += sig * np.sqrt(0.5 * (1 + pan))


def t_axis(d):
    return np.arange(int(d * SR)) / SR


def lowpass(x, cutoff):
    a = np.exp(-2 * np.pi * cutoff / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i, v in enumerate(x):
        acc = (1 - a) * v + a * acc
        y[i] = acc
    return y


def rhodes(m, d, vel=0.6):
    t = t_axis(d)
    f = midi(m)
    env = np.exp(-t * 1.6) * (1 - np.exp(-t * 300))
    trem = 1 + 0.08 * np.sin(2 * np.pi * 4.5 * t)
    tone = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t * 4) + 0.12 * np.sin(2 * np.pi * 3.01 * f * t) * np.exp(-t * 8)
    bell = 0.15 * np.sin(2 * np.pi * 7.0 * f * t) * np.exp(-t * 25)
    return vel * env * trem * (tone + bell)


def pad(m, d):
    t = t_axis(d)
    f = midi(m)
    s = sum(np.sin(2 * np.pi * f * k * (1 + det) * t) / k for k in (1, 2, 3, 4) for det in (-0.004, 0.004))
    env = np.minimum(1, t / 0.8) * np.minimum(1, (d - t) / 0.8)
    return 0.12 * env * s


def bass(m, d):
    t = t_axis(d)
    f = midi(m)
    env = np.minimum(1, t / 0.01) * np.exp(-t * 2.2)
    return 0.5 * env * (np.sin(2 * np.pi * f * t) + 0.25 * np.sin(2 * np.pi * 2 * f * t))


def kick():
    t = t_axis(0.45)
    f = 45 + 85 * np.exp(-t * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return 0.9 * np.sin(ph) * np.exp(-t * 7.5)


def snare():
    t = t_axis(0.3)
    n = rng.standard_normal(len(t))
    n = n - lowpass(n, 1800)
    return 0.32 * (n * np.exp(-t * 18) + 0.6 * np.sin(2 * np.pi * 190 * t) * np.exp(-t * 30))


def hat(open_=False):
    t = t_axis(0.18 if open_ else 0.06)
    n = rng.standard_normal(len(t))
    n = n - lowpass(n, 7000)
    return 0.09 * n * np.exp(-t * (14 if open_ else 70))


def pluck(m, d=0.6):
    t = t_axis(d)
    f = midi(m)
    return 0.32 * np.exp(-t * 6) * (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t * 10))


# Fa majeur : Fmaj7 – Am7 – Dm7 – Sib maj7
CHORDS = [
    (41, [53, 57, 60, 64]),
    (45, [52, 55, 57, 60]),
    (38, [53, 57, 60, 62]),
    (46, [50, 53, 57, 58]),
]

# 1) intro : nappe feutrée, accords doux et lointains, montée vers l'ouverture
n_intro = max(4, int(DROP / 2.3) + 1)
for i in range(n_intro):
    root, notes = CHORDS[i % 4]
    at = i * 2.3
    if at >= DROP:
        break
    for n in notes:
        add(lowpass(pad(n, 2.6), 900), at, pan=rng.uniform(-0.4, 0.4), gain=0.9)
riser_t = t_axis(2.5)
riser = rng.standard_normal(len(riser_t)) * (riser_t / riser_t[-1]) ** 2.2
riser = riser - lowpass(riser, 2500)
add(0.06 * riser, DROP - 2.5, gain=1.0)
add(0.35 * np.sin(2 * np.pi * midi(29) * t_axis(0.9)) * np.exp(-t_axis(0.9) * 3), DROP - 0.05, gain=0.8)

# 2) groove : à partir de l'ouverture, mesure après mesure
pent = [65, 67, 69, 72, 74, 77]
melody_bars = set()
bar = 0
at = DROP
while at < BRAND - 0.05:
    root, notes = CHORDS[bar % 4]
    # accords piano électrique (temps 1 et contretemps du 3)
    for n in notes:
        add(rhodes(n, BAR * 0.9, 0.18), at, pan=rng.uniform(-0.3, 0.3))
        add(rhodes(n, BEAT * 1.4, 0.10), at + 2.5 * BEAT, pan=rng.uniform(-0.3, 0.3))
    # basse syncopée
    add(bass(root, BEAT * 1.4), at)
    add(bass(root, BEAT * 0.6), at + 1.5 * BEAT)
    add(bass(root + 7, BEAT * 0.9), at + 2.5 * BEAT)
    # batterie avec léger swing
    for b in range(4):
        add(kick(), at + b * BEAT, gain=1.0 if b in (0, 2) else 0.0)
        if b in (1, 3):
            add(snare(), at + b * BEAT)
        for h in range(2):
            swing = 0.06 * BEAT if h == 1 else 0.0
            add(hat(open_=(b == 3 and h == 1)), at + (b + h / 2) * BEAT + swing, pan=0.3)
    if bar % 2 == 1:
        add(kick(), at + 3.5 * BEAT, gain=0.55)
    # mélodie : sur la partie téléphone, motif pentatonique qui donne de l'élan
    if at >= PHONE - 0.5:
        for k in range(8):
            if rng.random() < 0.7:
                add(pluck(pent[(bar * 3 + k * 2) % len(pent)]), at + k * BEAT / 2, pan=-0.25)
    at += BAR
    bar += 1

# 3) le logo s'écrit : les percussions s'arrêtent, accord suspendu et arpège scintillant
sus = [53, 58, 60, 65, 70]
for n in sus:
    add(pad(n, FINAL - BRAND + 0.4), BRAND, pan=rng.uniform(-0.5, 0.5), gain=0.5)
arp_at = BRAND + 0.4
k = 0
while arp_at < FINAL - 0.3:
    add(rhodes(sus[k % len(sus)] + 12, 1.2, 0.09), arp_at, pan=(-0.5 if k % 2 else 0.5))
    arp_at += BEAT / 2
    k += 1

# 4) résolution : accord de Fa majeur, coup de grosse caisse, extinction douce
add(kick(), FINAL, gain=0.9)
add(bass(29, 3.5), FINAL, gain=0.9)
for n in [53, 57, 60, 64, 69]:
    add(rhodes(n, 5.0, 0.22), FINAL, pan=rng.uniform(-0.3, 0.3))
    add(pad(n, DUR - FINAL), FINAL, gain=0.8)

# effet de pompe (la musique respire avec la grosse caisse) pendant le groove
t_all = np.arange(n_total) / SR
phase = ((t_all - DROP) % BEAT) / BEAT
pump = np.where((t_all >= DROP) & (t_all < BRAND), 0.72 + 0.28 * np.minimum(1, phase / 0.45), 1.0)

# réverbération légère (réponse impulsionnelle exponentielle)
ir_t = t_axis(1.6)
ir = rng.standard_normal(len(ir_t)) * np.exp(-ir_t * 4.2)
ir = lowpass(ir, 5000)
ir /= np.sqrt(np.sum(ir**2))


def reverb(x):
    n = len(x) + len(ir)
    size = 1 << (n - 1).bit_length()
    return np.fft.irfft(np.fft.rfft(x, size) * np.fft.rfft(ir, size), size)[: len(x)]


L2 = L * pump + 0.18 * reverb(L)
R2 = R * pump + 0.18 * reverb(R)

# fondu de sortie, saturation douce, normalisation
n_out = int(DUR * SR)
fade = np.ones(n_out)
f_len = int(2.5 * SR)
fade[-f_len:] = np.linspace(1, 0, f_len) ** 1.5
st = np.stack([L2[:n_out], R2[:n_out]], axis=1) * fade[:, None]
st = np.tanh(st * 1.2) / 1.2
st /= np.max(np.abs(st)) / 0.89
pcm = (st * 32767).astype("<i2")
with wave.open(OUT, "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print("musique :", OUT, f"{n_out / SR:.2f} s")
