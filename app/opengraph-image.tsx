import { ImageResponse } from "next/og";

/**
 * Phase 9: generated OG image (1200×630) — no binary asset required.
 * Rendered at build/request time by next/og.
 */
export const alt = "DripLnk — from idea to printed part";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "space-between",
          padding: 80,
          background: "linear-gradient(135deg, #101215 0%, #181a1f 60%, #1c2b1c 100%)",
          color: "#f2f4f1",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 12,
              background: "#527953",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 32,
              fontWeight: 700,
              color: "#0e100e",
            }}
          >
            D
          </div>
          <div style={{ fontSize: 44, fontWeight: 600, letterSpacing: 2 }}>DripLnk</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.1, maxWidth: 900 }}>
            From idea to printed part — one pipeline.
          </div>
          <div style={{ fontSize: 30, color: "#9aa39a", maxWidth: 860 }}>
            CAD marketplace · on-demand manufacturing · freelance engineering
          </div>
        </div>

        <div style={{ display: "flex", gap: 24, fontSize: 24, color: "#527953" }}>
          <span>driplnk.in</span>
          <span>/models</span>
          <span>/mart</span>
          <span>/freelance</span>
        </div>
      </div>
    ),
    size,
  );
}
