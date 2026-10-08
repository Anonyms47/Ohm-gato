import { NextResponse } from "next/server";
import { addClientMessage, addInspiration, editCustomRequest, respondToProposal, type CustomAccess } from "@/lib/custom/service";
import { getCurrentUser } from "@/lib/auth/session";
import { clientIp, isSameOrigin, jsonError } from "@/lib/http";
import { ownedReferences } from "@/lib/orders/owner-cookie";

/**
 * Actions du client sur sa demande : message (avec pièce jointe), inspiration,
 * modification, réponse à une proposition. Accès par lien personnel ou session.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonError(403, "FORBIDDEN", "Requête refusée.");
  const form = await request.formData().catch(() => null);
  if (!form) return jsonError(400, "BAD_REQUEST", "Requête illisible.");

  const token = form.get("token");
  const reference = form.get("reference");
  const [ownedRefs, user] = await Promise.all([ownedReferences("demandes"), getCurrentUser()]);
  const access: CustomAccess | null =
    typeof token === "string" && token
      ? { token, ownedRefs, userId: user?.id ?? null }
      : typeof reference === "string" && reference
        ? { reference }
        : null;
  if (!access) return jsonError(400, "BAD_REQUEST", "Demande non précisée.");

  const file = form.get("file");
  const upload = file instanceof File && file.size > 0 ? file : null;
  const ip = clientIp(request);
  const action = form.get("action");

  const result =
    action === "message"
      ? await addClientMessage(access, String(form.get("body") ?? ""), upload, ip)
      : action === "inspiration" && upload
        ? await addInspiration(access, upload, ip)
        : action === "edit"
          ? await editCustomRequest(access, parseJson(form.get("payload")))
          : action === "respond"
            ? await respondToProposal(access, String(form.get("proposalId") ?? ""), form.get("accept") === "true")
            : null;
  if (!result) return jsonError(400, "BAD_REQUEST", "Action inconnue.");
  if (!result.ok) return jsonError(result.status, result.code, result.message);
  return NextResponse.json({ ok: true, ...(result.data ?? {}) });
}

function parseJson(value: FormDataEntryValue | null): unknown {
  try {
    return JSON.parse(String(value ?? "{}"));
  } catch {
    return null;
  }
}
