"use client";

import { useState } from "react";
import { unsubscribeAction } from "@/app/(site)/alertes/actions";
import { Button } from "@/components/ui/Button";

export function UnsubscribeForm({ token }: { token: string }) {
  const [state, setState] = useState<{ ok: boolean; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  if (state?.ok) {
    return (
      <p role="status" className="mt-4 text-[1.1rem] font-bold" data-testid="desinscription-faite">
        {state.message}
      </p>
    );
  }
  return (
    <div className="mt-4 flex flex-col gap-4">
      <p className="text-[1.1rem]">Vous ne recevrez plus d&apos;e-mail à l&apos;ouverture des prochaines fournées. Vos éventuelles commandes ne sont pas concernées.</p>
      {state && (
        <p role="alert" className="font-bold text-erreur">
          {state.message}
        </p>
      )}
      <Button
        variant="primary"
        className="self-start"
        state={busy ? "loading" : "idle"}
        loadingLabel="Désinscription…"
        onClick={async () => {
          setBusy(true);
          setState(await unsubscribeAction(token));
          setBusy(false);
        }}
      >
        Me désinscrire
      </Button>
    </div>
  );
}
