import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { jsonError } from "@/lib/http";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

/** Export des données personnelles (JSON), lues avec la session : uniquement les siennes. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return jsonError(401, "UNAUTHENTICATED", "Connectez-vous.");
  const db = await supabaseServer();
  const [profile, addresses, favorites, preferences, orders, requests, acceptances] = await Promise.all([
    db.from("profiles").select("full_name, phone, email, marketing_consent, order_updates_consent, consents_updated_at, created_at").eq("id", user.id).single(),
    db.from("addresses").select("label, recipient_name, recipient_phone, address_line, district, landmark, floor_door, instructions, latitude, longitude, created_at"),
    db.from("favorites").select("created_at, products(name)"),
    db.from("notification_preferences").select("new_cycle, order_updates, channel").maybeSingle(),
    db
      .from("orders")
      .select(
        "reference, status, payment_status, fulfillment, customer_name, customer_phone, customer_email, address_line, district, landmark, recipient_name, recipient_phone, latitude, longitude, subtotal_fcfa, total_fcfa, created_at, paid_at, order_items(product_name, variant_label, flavor_name, quantity, unit_price_fcfa, line_total_fcfa), payments(provider, status, amount_fcfa, created_at, paid_at)",
      )
      .order("created_at", { ascending: false }),
    db
      .from("custom_requests")
      .select("reference, status, occasion, event_at, guests, ambiance, personalization, budget_fcfa, created_at, custom_request_items(kind, quantity, format, flavors, description), custom_request_messages(body, from_staff, created_at), custom_proposals(version, body, total_fcfa, status, created_at)"),
    // Preuves d'acceptation (table réservée au serveur) : filtrées sur le compte connecté.
    supabaseAdmin()
      .from("order_acceptances")
      .select(
        "accepted_at, channel, orders(reference), terms:legal_document_versions!order_acceptances_terms_version_id_fkey(title, version), cancellation:legal_document_versions!order_acceptances_cancellation_version_id_fkey(title, version)",
      )
      .eq("user_id", user.id),
  ]);
  const body = {
    exportedAt: new Date().toISOString(),
    account: { id: user.id, phone: user.phone, email: user.email },
    profile: profile.data,
    preferences: preferences.data,
    addresses: addresses.data,
    favorites: favorites.data,
    orders: orders.data,
    customRequests: requests.data,
    acceptedTerms: acceptances.data,
  };
  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="ohmegato-mes-donnees-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
