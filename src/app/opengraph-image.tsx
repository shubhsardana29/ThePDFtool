import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "PDF Tools — every PDF tool, your files stay yours";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "linear-gradient(135deg, #18181b 0%, #09090b 100%)",
          color: "#fafafa",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 12,
              background: "#ef4444",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontSize: 30,
              fontWeight: 700,
            }}
          >
            P
          </div>
          <div style={{ fontSize: 34, fontWeight: 700 }}>PDF Tools</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 82, fontWeight: 800, letterSpacing: -2 }}>
            Every PDF tool.
          </div>
          <div style={{ fontSize: 82, fontWeight: 800, letterSpacing: -2, color: "#71717a" }}>
            Your files stay yours.
          </div>
        </div>
        <div style={{ fontSize: 28, color: "#a1a1aa" }}>
          23 free tools · most run entirely in your browser · no sign-up
        </div>
      </div>
    ),
    size,
  );
}
