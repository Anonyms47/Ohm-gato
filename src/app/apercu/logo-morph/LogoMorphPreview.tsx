"use client";

import { useRef, useState } from "react";
import { LogoMorph, type LogoMorphHandle } from "@/components/brand/logo-morph/LogoMorph";

export function LogoMorphPreview() {
  const ref = useRef<LogoMorphHandle>(null);
  const [t, setT] = useState(0);
  const [framing, setFraming] = useState<"auto" | "scene" | "tight">("auto");
  const [ended, setEnded] = useState(false);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6">
      <h1 className="text-lg font-bold">Morphing : logotype → symbole (6 s)</h1>
      <div className="overflow-hidden rounded-lg">
        <LogoMorph ref={ref} framing={framing} onEnd={() => setEnded(true)} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="min-h-11 rounded-md bg-[#3A2418] px-4 font-bold text-[#F5E9D6]"
          onClick={() => {
            setEnded(false);
            ref.current?.play();
          }}
        >
          {ended ? "Relire" : "Lire depuis le début"}
        </button>
        <label className="flex min-h-11 flex-1 items-center gap-2">
          <span className="w-16 tabular-nums">{t.toFixed(2)} s</span>
          <input
            type="range"
            min={0}
            max={6}
            step={0.01}
            value={t}
            aria-label="Position dans l'animation"
            className="flex-1"
            onChange={(e) => {
              const v = Number(e.target.value);
              setT(v);
              ref.current?.seek(v);
            }}
          />
        </label>
        <select className="min-h-11 rounded-md border px-2" value={framing} aria-label="Cadrage" onChange={(e) => setFraming(e.target.value as typeof framing)}>
          <option value="auto">Cadrage auto</option>
          <option value="scene">Scène 16:9</option>
          <option value="tight">Cadrage serré</option>
        </select>
      </div>
    </main>
  );
}
