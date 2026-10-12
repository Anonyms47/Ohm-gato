"use client";

import { useEffect, useState } from "react";
import { humanDuration } from "@/lib/admin/tasks";

/**
 * Temps restant, calé sur l'horloge du serveur (l'heure du téléphone peut être fausse) :
 * on mesure l'écart au chargement et on avance minute par minute.
 */
export function Countdown({ target, serverNow, prefix = "dans" }: { target: string; serverNow: number; prefix?: string }) {
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    const offset = serverNow - Date.now();
    const tick = () => setNow(Date.now() + offset);
    const timer = window.setInterval(tick, 30_000);
    return () => window.clearInterval(timer);
  }, [serverNow]);
  const remaining = Date.parse(target) - now;
  if (remaining <= 0) return <span>maintenant</span>;
  return (
    <span className="tabular-nums">
      {prefix} {humanDuration(remaining)}
    </span>
  );
}
