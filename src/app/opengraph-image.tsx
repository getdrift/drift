import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const alt = "Drift — weekly competitive intel for B2B SaaS";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#0b0d10",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 22,
            color: "#5b636d",
            fontSize: 18,
            letterSpacing: 4,
            textTransform: "uppercase",
            marginBottom: 24,
            fontFamily: "ui-monospace, monospace",
          }}
        >
          <div style={{ display: "flex", gap: 10 }}>
            <div
              style={{
                width: 18,
                height: 18,
                borderRadius: 9,
                background: "#5eead4",
                opacity: 0.25,
                display: "flex",
              }}
            />
            <div
              style={{
                width: 18,
                height: 18,
                borderRadius: 9,
                background: "#5eead4",
                opacity: 0.55,
                display: "flex",
              }}
            />
            <div
              style={{
                width: 18,
                height: 18,
                borderRadius: 9,
                background: "#5eead4",
                opacity: 1,
                display: "flex",
              }}
            />
          </div>
          <div style={{ display: "flex" }}>drift · competitive intel</div>
        </div>

        <div
          style={{
            display: "flex",
            color: "#e6e8eb",
            fontSize: 88,
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: -2,
            marginBottom: 28,
            whiteSpace: "pre-line",
          }}
        >
          {"Know what your competitors\ndid this week."}
        </div>

        <div
          style={{
            display: "flex",
            color: "#9aa3ad",
            fontSize: 30,
            lineHeight: 1.4,
            maxWidth: 980,
          }}
        >
          Drift scrapes their pricing, changelog & jobs pages every week,
          then emails you what changed and what to do about it.
        </div>

        <div
          style={{
            display: "flex",
            color: "#5b636d",
            fontSize: 18,
            letterSpacing: 3,
            textTransform: "uppercase",
            marginTop: 40,
            fontFamily: "ui-monospace, monospace",
          }}
        >
          AI-powered · self-hostable · MIT
        </div>
      </div>
    ),
    { ...size },
  );
}
