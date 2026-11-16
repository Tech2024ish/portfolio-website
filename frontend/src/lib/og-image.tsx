import { ImageResponse } from "next/og";

/** Social sharing images (Open Graph and X/Twitter): 1200×630 cards in the site's colours. */
export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

const colors = {
  canvas: "#080d17",
  surface: "#0d1520",
  border: "#2b3546",
  fg: "#f2f3f7",
  muted: "#8b95a5",
  accent: "#08a9c7",
};

export function socialCard({
  eyebrow,
  title,
  description,
  footer,
}: {
  eyebrow: string;
  title: string;
  description: string;
  footer: string;
}): ImageResponse {
  // Shortened at a word boundary, so a card never ends mid-word.
  const clamp = (text: string, max: number) => {
    if (text.length <= max) return text;
    const cut = text.slice(0, max - 1);
    const space = cut.lastIndexOf(" ");
    return `${(space > max / 2 ? cut.slice(0, space) : cut).replace(/[\s,.;:–-]+$/, "")}…`;
  };
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "72px 80px",
        background: `linear-gradient(135deg, ${colors.canvas} 0%, ${colors.surface} 100%)`,
        color: colors.fg,
        fontFamily: "sans-serif",
        borderBottom: `12px solid ${colors.accent}`,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div
          style={{
            display: "flex",
            fontSize: 28,
            color: colors.accent,
            letterSpacing: 2,
            textTransform: "uppercase",
          }}
        >
          {clamp(eyebrow, 60)}
        </div>
        <div
          style={{ display: "flex", fontSize: title.length > 40 ? 64 : 80, fontWeight: 800, lineHeight: 1.1 }}
        >
          {clamp(title, 80)}
        </div>
        <div style={{ display: "flex", fontSize: 32, color: colors.muted, lineHeight: 1.4, maxWidth: 1000 }}>
          {clamp(description, 160)}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderTop: `2px solid ${colors.border}`,
          paddingTop: 28,
          fontSize: 28,
        }}
      >
        <div style={{ display: "flex", fontWeight: 800 }}>
          JC<span style={{ color: colors.accent }}>.</span>
        </div>
        <div style={{ display: "flex", color: colors.muted }}>{clamp(footer, 70)}</div>
      </div>
    </div>,
    OG_SIZE,
  );
}
