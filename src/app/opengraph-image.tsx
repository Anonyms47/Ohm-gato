import { ImageResponse } from "next/og";
import { brand } from "@/config/brand";
import { LOGO_PNG_BASE64 } from "@/lib/receipt/logo";

export const alt = `${brand.name} — pâtisseries faites maison à Dakar`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Image d'aperçu par défaut (WhatsApp, Facebook, Google) : logo et promesse, aux couleurs de la marque. */
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          gap: 64,
          padding: "0 96px",
          background: "#f5e9d6",
          color: "#4a2a1c",
        }}
      >
        <img src={`data:image/png;base64,${LOGO_PNG_BASE64}`} width={240} height={240} alt="" />
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 96, fontWeight: 700, letterSpacing: 2 }}>{brand.name}</div>
          <div style={{ fontSize: 44, color: "#6b4a3a" }}>Pâtisseries faites maison à Dakar</div>
          <div style={{ display: "flex", marginTop: 12, fontSize: 32, color: "#c27a2e", fontWeight: 700 }}>ohmegato.com</div>
        </div>
      </div>
    ),
    size,
  );
}
