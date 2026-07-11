import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Wazenly — Official WhatsApp Business API Platform";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0f1117 0%, #14171f 100%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 28 }}>
          <div
            style={{
              display: "flex",
              width: 84,
              height: 84,
              borderRadius: 20,
              background: "#25D366",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 44,
              fontWeight: 700,
              color: "#0f1117",
            }}
          >
            W
          </div>
          <span style={{ fontSize: 64, fontWeight: 700, color: "#ffffff", letterSpacing: -1 }}>WAZENLY</span>
        </div>
        <div style={{ display: "flex", fontSize: 30, color: "#25D366", fontWeight: 600, marginBottom: 12 }}>
          Official WhatsApp Business API Platform
        </div>
        <div style={{ display: "flex", fontSize: 22, color: "rgba(255,255,255,0.5)" }}>
          Campaigns · Shared Inbox · Automation · Analytics
        </div>
      </div>
    ),
    { ...size }
  );
}
