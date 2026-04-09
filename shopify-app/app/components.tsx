import type { CSSProperties, PropsWithChildren, ReactNode } from "react";

const palette = {
  base: "var(--fs-base)",
  indigo: "var(--fs-indigo)",
  violet: "var(--fs-violet)",
  sky: "var(--fs-sky)",
  white: "var(--fs-white)",
  surface: "var(--fs-surface)",
  surfaceStrong: "var(--fs-surface-strong)",
  surfaceMuted: "var(--fs-surface-muted)",
  border: "var(--fs-border)",
  text: "var(--fs-text)",
  textMuted: "var(--fs-text-muted)",
  success: "var(--fs-success)",
  warning: "var(--fs-warning)",
  critical: "var(--fs-critical)",
};

const shadows = {
  shell: "0 32px 90px rgba(15, 23, 42, 0.34)",
  card: "0 16px 44px rgba(15, 23, 42, 0.26)",
  glow: "0 0 0 1px rgba(124, 58, 237, 0.18), 0 24px 70px rgba(79, 70, 229, 0.2)",
};

const layoutWidth = 1220;

function toneColors(tone: "default" | "accent" | "success" | "warning" | "critical" | "subtle") {
  if (tone === "accent") {
    return {
      background: "linear-gradient(145deg, rgba(79, 70, 229, 0.28), rgba(56, 189, 248, 0.2))",
      border: "1px solid rgba(56, 189, 248, 0.26)",
      text: palette.white,
      muted: "rgba(224, 231, 255, 0.9)",
    };
  }
  if (tone === "success") {
    return {
      background: "linear-gradient(145deg, rgba(14, 116, 144, 0.24), rgba(56, 189, 248, 0.16))",
      border: "1px solid rgba(56, 189, 248, 0.24)",
      text: palette.white,
      muted: "rgba(224, 242, 254, 0.88)",
    };
  }
  if (tone === "warning") {
    return {
      background: "linear-gradient(145deg, rgba(124, 58, 237, 0.2), rgba(245, 158, 11, 0.18))",
      border: "1px solid rgba(245, 158, 11, 0.22)",
      text: palette.white,
      muted: "rgba(254, 240, 138, 0.88)",
    };
  }
  if (tone === "critical") {
    return {
      background: "linear-gradient(145deg, rgba(127, 29, 29, 0.35), rgba(124, 58, 237, 0.18))",
      border: "1px solid rgba(248, 113, 113, 0.24)",
      text: palette.white,
      muted: "rgba(254, 202, 202, 0.88)",
    };
  }
  if (tone === "subtle") {
    return {
      background: "linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(148, 163, 184, 0.04))",
      border: `1px solid ${palette.border}`,
      text: palette.text,
      muted: palette.textMuted,
    };
  }
  return {
    background: `linear-gradient(180deg, ${palette.surface}, rgba(15, 23, 42, 0.72))`,
    border: `1px solid ${palette.border}`,
    text: palette.text,
    muted: palette.textMuted,
  };
}

export function AppShell({
  title,
  subtitle,
  actions,
  children,
}: PropsWithChildren<{
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}>) {
  return (
    <div
      style={{
        minHeight: "100vh",
        color: palette.text,
        background:
          "radial-gradient(circle at top left, rgba(124, 58, 237, 0.28), transparent 24%), radial-gradient(circle at top right, rgba(56, 189, 248, 0.2), transparent 26%), linear-gradient(180deg, rgba(15, 23, 42, 0.98), rgba(15, 23, 42, 1))",
      }}
    >
      <div style={{ maxWidth: layoutWidth, margin: "0 auto", padding: "0 20px 48px" }}>
        <div
          style={{
            position: "relative",
            overflow: "hidden",
            borderRadius: 32,
            padding: "28px 26px 30px",
            marginBottom: 24,
            border: `1px solid ${palette.border}`,
            background:
              "linear-gradient(145deg, rgba(79, 70, 229, 0.22), rgba(15, 23, 42, 0.92) 35%, rgba(124, 58, 237, 0.24) 100%)",
            boxShadow: shadows.shell,
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: "auto -60px -90px auto",
              width: 280,
              height: 280,
              background: "radial-gradient(circle, rgba(56, 189, 248, 0.32), transparent 68%)",
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: "-120px auto auto -80px",
              width: 260,
              height: 260,
              background: "radial-gradient(circle, rgba(124, 58, 237, 0.3), transparent 70%)",
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "relative",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 18,
              flexWrap: "wrap",
            }}
          >
            <div style={{ maxWidth: 820 }}>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "7px 12px",
                  borderRadius: 999,
                  marginBottom: 14,
                  border: "1px solid rgba(56, 189, 248, 0.2)",
                  background: "rgba(15, 23, 42, 0.42)",
                  color: "rgba(224, 231, 255, 0.92)",
                  fontSize: 11,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  fontWeight: 700,
                }}
              >
                Forestock Embedded Command Surface
              </div>
              <h1
                style={{
                  margin: 0,
                  fontFamily: '"Space Grotesk", "Manrope", sans-serif',
                  fontSize: "clamp(2rem, 4vw, 3.8rem)",
                  lineHeight: 0.98,
                  letterSpacing: "-0.04em",
                  color: palette.white,
                }}
              >
                {title}
              </h1>
              {subtitle ? (
                <p
                  style={{
                    margin: "14px 0 0",
                    maxWidth: 760,
                    fontSize: 15,
                    lineHeight: 1.75,
                    color: "rgba(226, 232, 240, 0.82)",
                  }}
                >
                  {subtitle}
                </p>
              ) : null}
            </div>
            {actions ? <div style={{ display: "flex", alignItems: "center", gap: 10 }}>{actions}</div> : null}
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

export function NavTabs({
  items,
  currentPath,
  search = "",
}: {
  items: Array<{ label: string; href: string }>;
  currentPath: string;
  search?: string;
}) {
  return (
    <div style={{ maxWidth: layoutWidth, margin: "0 auto", padding: "20px 20px 18px" }}>
      <div
        style={{
          display: "inline-flex",
          gap: 10,
          flexWrap: "wrap",
          padding: 10,
          borderRadius: 24,
          border: `1px solid ${palette.border}`,
          background: "rgba(15, 23, 42, 0.72)",
          backdropFilter: "blur(16px)",
          boxShadow: shadows.glow,
        }}
      >
        {items.map((item) => {
          const active = currentPath === item.href;
          const href = `${item.href}${search}`;
          return (
            <a
              key={href}
              href={href}
              style={{
                textDecoration: "none",
                padding: "12px 18px",
                borderRadius: 16,
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: "-0.01em",
                color: active ? palette.white : "rgba(226, 232, 240, 0.8)",
                background: active
                  ? "linear-gradient(135deg, rgba(79, 70, 229, 0.92), rgba(124, 58, 237, 0.92))"
                  : "rgba(255, 255, 255, 0.02)",
                border: active ? "1px solid rgba(191, 219, 254, 0.18)" : "1px solid transparent",
                boxShadow: active ? "0 12px 28px rgba(79, 70, 229, 0.34)" : "none",
              }}
            >
              {item.label}
            </a>
          );
        })}
      </div>
    </div>
  );
}

export function Section({
  title,
  description,
  children,
}: PropsWithChildren<{ title: string; description?: string }>) {
  return (
    <section style={{ marginBottom: 26 }}>
      <div style={{ marginBottom: 14 }}>
        <h2
          style={{
            margin: 0,
            fontFamily: '"Space Grotesk", "Manrope", sans-serif',
            fontSize: 22,
            lineHeight: 1.15,
            letterSpacing: "-0.03em",
            color: palette.white,
          }}
        >
          {title}
        </h2>
        {description ? (
          <p style={{ margin: "8px 0 0", fontSize: 14, lineHeight: 1.7, color: palette.textMuted }}>{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function Grid({
  columns = 2,
  children,
}: PropsWithChildren<{ columns?: 2 | 3 | 4 }>) {
  return (
    <div
      style={{
        display: "grid",
        gap: 18,
        gridTemplateColumns:
          columns === 4
            ? "repeat(auto-fit, minmax(200px, 1fr))"
            : columns === 3
              ? "repeat(auto-fit, minmax(240px, 1fr))"
              : "repeat(auto-fit, minmax(300px, 1fr))",
      }}
    >
      {children}
    </div>
  );
}

export function Card({
  children,
  tone = "default",
  style,
}: PropsWithChildren<{
  tone?: "default" | "accent" | "success" | "warning" | "critical" | "subtle";
  style?: CSSProperties;
}>) {
  const toneStyle = toneColors(tone);

  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 28,
        padding: 20,
        background: toneStyle.background,
        border: toneStyle.border,
        boxShadow: tone === "accent" ? shadows.glow : shadows.card,
        color: toneStyle.text,
        ...style,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: "-30% auto auto 65%",
          width: 180,
          height: 180,
          background:
            tone === "accent"
              ? "radial-gradient(circle, rgba(56, 189, 248, 0.25), transparent 70%)"
              : "radial-gradient(circle, rgba(255, 255, 255, 0.07), transparent 70%)",
          pointerEvents: "none",
        }}
      />
      <div style={{ position: "relative" }}>{children}</div>
    </div>
  );
}

export function MetricCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "accent" | "success" | "warning" | "critical" | "subtle";
}) {
  const toneStyle = toneColors(tone);

  return (
    <Card tone={tone}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.14em",
          color: toneStyle.muted,
          marginBottom: 16,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: '"Space Grotesk", "Manrope", sans-serif',
          fontSize: 34,
          fontWeight: 700,
          lineHeight: 1,
          letterSpacing: "-0.05em",
          marginBottom: hint ? 10 : 0,
        }}
      >
        {value}
      </div>
      {hint ? <div style={{ fontSize: 14, color: toneStyle.muted, lineHeight: 1.65 }}>{hint}</div> : null}
    </Card>
  );
}

export function Badge({
  children,
  tone = "default",
}: PropsWithChildren<{ tone?: "default" | "success" | "warning" | "critical" | "accent" | "subtle" }>) {
  const styles: Record<string, CSSProperties> = {
    default: {
      background: "rgba(148, 163, 184, 0.12)",
      color: palette.text,
      border: `1px solid ${palette.border}`,
    },
    subtle: {
      background: "rgba(255, 255, 255, 0.04)",
      color: palette.text,
      border: `1px solid ${palette.border}`,
    },
    success: {
      background: "rgba(56, 189, 248, 0.12)",
      color: "#bff4ff",
      border: "1px solid rgba(56, 189, 248, 0.18)",
    },
    warning: {
      background: "rgba(245, 158, 11, 0.14)",
      color: "#fde68a",
      border: "1px solid rgba(245, 158, 11, 0.2)",
    },
    critical: {
      background: "rgba(248, 113, 113, 0.14)",
      color: "#fecaca",
      border: "1px solid rgba(248, 113, 113, 0.2)",
    },
    accent: {
      background: "linear-gradient(135deg, rgba(79, 70, 229, 0.24), rgba(124, 58, 237, 0.24))",
      color: palette.white,
      border: "1px solid rgba(124, 58, 237, 0.22)",
    },
  };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "7px 12px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 800,
        textTransform: "uppercase",
        letterSpacing: "0.12em",
        ...styles[tone],
      }}
    >
      {children}
    </span>
  );
}

export function KeyValueList({
  items,
}: {
  items: Array<{ label: string; value: ReactNode }>;
}) {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {items.map((item, index) => (
        <div
          key={`${item.label}-${index}`}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 18,
            paddingBottom: 12,
            borderBottom: "1px solid rgba(148, 163, 184, 0.16)",
          }}
        >
          <div style={{ fontSize: 13, color: palette.textMuted, lineHeight: 1.6 }}>{item.label}</div>
          <div style={{ fontSize: 14, fontWeight: 700, textAlign: "right", lineHeight: 1.5, color: palette.white }}>
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ActionButton({
  children,
  loading,
  tone = "primary",
}: PropsWithChildren<{ loading?: boolean; tone?: "primary" | "secondary" }>) {
  return (
    <s-button type="submit" loading={loading} variant={tone === "secondary" ? "secondary" : undefined}>
      {loading ? "Running..." : children}
    </s-button>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <Card tone="subtle">
      <div
        style={{
          fontFamily: '"Space Grotesk", "Manrope", sans-serif',
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: "-0.03em",
          marginBottom: 10,
          color: palette.white,
        }}
      >
        {title}
      </div>
      <div style={{ fontSize: 14, lineHeight: 1.7, color: palette.textMuted }}>{body}</div>
    </Card>
  );
}

export function InfoBanner({
  title,
  body,
  tone = "accent",
  actions,
}: {
  title: string;
  body: ReactNode;
  tone?: "accent" | "success" | "warning" | "critical" | "subtle";
  actions?: ReactNode;
}) {
  const toneStyle = toneColors(tone);

  return (
    <Card tone={tone} style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div style={{ maxWidth: 880 }}>
          <div
            style={{
              fontFamily: '"Space Grotesk", "Manrope", sans-serif',
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: "-0.03em",
              marginBottom: 10,
              color: toneStyle.text,
            }}
          >
            {title}
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.72, color: toneStyle.muted }}>{body}</div>
        </div>
        {actions ? <div style={{ display: "flex", alignItems: "center" }}>{actions}</div> : null}
      </div>
    </Card>
  );
}

export function InlineList({ items }: { items: string[] }) {
  return (
    <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8, color: palette.textMuted }}>
      {items.map((item) => (
        <li key={item} style={{ marginBottom: 4 }}>
          {item}
        </li>
      ))}
    </ul>
  );
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "Not available";
  return new Date(value).toLocaleString();
}

export function toneForForecast(
  status: string | null | undefined,
): "default" | "success" | "warning" | "critical" | "accent" {
  if (!status) return "warning";
  const normalized = status.toUpperCase();
  if (normalized.includes("COMPLETED")) return "success";
  if (normalized.includes("RUNNING") || normalized.includes("PENDING")) return "accent";
  if (normalized.includes("FAILED") || normalized.includes("ERROR")) return "critical";
  return "warning";
}

export function toneForReadiness({
  activeProductCount,
  hasSalesHistory,
  forecastStatus,
}: {
  activeProductCount: number;
  hasSalesHistory: boolean;
  forecastStatus: string | null;
}): { label: string; tone: "success" | "warning" | "critical" | "accent" } {
  if (forecastStatus?.toUpperCase().includes("COMPLETED") && activeProductCount > 0 && hasSalesHistory) {
    return { label: "Recommendations ready", tone: "success" };
  }
  if (forecastStatus?.toUpperCase().includes("RUNNING") || forecastStatus?.toUpperCase().includes("PENDING")) {
    return { label: "Forecast running", tone: "accent" };
  }
  if (activeProductCount > 0 || hasSalesHistory) {
    return { label: "Needs completion", tone: "warning" };
  }
  return { label: "Needs setup", tone: "critical" };
}

export function toneForBoolean(value: boolean, positiveTone: "success" | "accent" = "success") {
  return value ? positiveTone : "warning";
}

