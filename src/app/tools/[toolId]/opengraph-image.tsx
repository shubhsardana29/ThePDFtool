import { ImageResponse } from "next/og";
import { getTool } from "@/lib/tools/registry";
import { TOOL_SEO } from "@/lib/tools/seo-content";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "PDF Tools";

export default async function OgImage({
  params,
}: {
  params: Promise<{ toolId: string }>;
}) {
  const { toolId } = await params;
  const tool = getTool(toolId);
  const seo = tool && TOOL_SEO[tool.id];

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
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 76, fontWeight: 800, letterSpacing: -2 }}>
            {tool?.name ?? "PDF Tools"}
          </div>
          <div style={{ fontSize: 30, color: "#a1a1aa", maxWidth: 950 }}>
            {tool?.description ?? "Every tool you need to work with PDFs."}
          </div>
        </div>
        <div style={{ display: "flex", gap: 16, fontSize: 24, color: "#d4d4d8" }}>
          <div
            style={{
              padding: "10px 24px",
              borderRadius: 999,
              border: "2px solid #3f3f46",
              display: "flex",
            }}
          >
            Free · No sign-up
          </div>
          <div
            style={{
              padding: "10px 24px",
              borderRadius: 999,
              border: "2px solid #3f3f46",
              display: "flex",
            }}
          >
            {tool?.runtime === "client" && seo
              ? "Runs in your browser — no upload"
              : "Files auto-deleted within 1 hour"}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
