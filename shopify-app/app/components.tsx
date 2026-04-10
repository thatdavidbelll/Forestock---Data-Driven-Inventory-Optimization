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
  shell: "0 18px 44px rgba(79, 70, 229, 0.08)",
  card: "0 10px 26px rgba(15, 23, 42, 0.06)",
  glow: "0 0 0 1px rgba(79, 70, 229, 0.1), 0 18px 38px rgba(15, 23, 42, 0.08)",
};

const layoutWidth = 1220;

function toneColors(tone: "default" | "accent" | "success" | "warning" | "critical" | "subtle") {
  if (tone === "accent") {
    return {
      background: "linear-gradient(135deg, rgba(79, 70, 229, 0.1) 0%, rgba(56, 189, 248, 0.14) 100%)",
      border: "1px solid rgba(79, 70, 229, 0.16)",
      text: palette.text,
      muted: palette.textMuted,
    };
  }
  if (tone === "success") {
    return {
      background: "linear-gradient(135deg, rgba(19, 121, 91, 0.1) 0%, rgba(56, 189, 248, 0.08) 100%)",
      border: "1px solid rgba(19, 121, 91, 0.16)",
      text: palette.text,
      muted: palette.textMuted,
    };
  }
  if (tone === "warning") {
    return {
      background: "linear-gradient(135deg, rgba(180, 83, 9, 0.1) 0%, rgba(124, 58, 237, 0.08) 100%)",
      border: "1px solid rgba(180, 83, 9, 0.18)",
      text: palette.text,
      muted: palette.textMuted,
    };
  }
  if (tone === "critical") {
    return {
      background: "linear-gradient(135deg, rgba(190, 18, 60, 0.1) 0%, rgba(124, 58, 237, 0.08) 100%)",
      border: "1px solid rgba(190, 18, 60, 0.18)",
      text: palette.text,
      muted: palette.textMuted,
    };
  }
  if (tone === "subtle") {
    return {
      background: palette.surfaceMuted,
      border: `1px solid ${palette.border}`,
      text: palette.text,
      muted: palette.textMuted,
    };
  }
  return {
    background: palette.surface,
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
          "radial-gradient(circle at top left, rgba(124, 58, 237, 0.14) 0, transparent 34%), radial-gradient(circle at top right, rgba(56, 189, 248, 0.16) 0, transparent 28%), linear-gradient(180deg, #f8faff 0%, #eef2ff 100%)",
      }}
    >
      <div style={{ maxWidth: layoutWidth, margin: "0 auto", padding: "0 20px 48px" }}>
        <div
          style={{
            borderRadius: 24,
            padding: "24px 24px 26px",
            margin: "20px 0 24px",
            border: `1px solid ${palette.border}`,
            background: palette.surface,
            boxShadow: shadows.shell,
          }}
        >
          <div
            style={{
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
                  padding: "6px 10px",
                  borderRadius: 999,
                  marginBottom: 12,
                  border: `1px solid ${palette.border}`,
                  background: "linear-gradient(135deg, rgba(79, 70, 229, 0.1) 0%, rgba(56, 189, 248, 0.12) 100%)",
                  color: palette.indigo,
                  fontSize: 12,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  fontWeight: 700,
                }}
              >
                Forestock
              </div>
              <h1
                style={{
                  margin: 0,
                  fontFamily: '"Space Grotesk", "Manrope", sans-serif',
                  fontSize: "clamp(1.9rem, 4vw, 3.2rem)",
                  lineHeight: 1.02,
                  letterSpacing: "-0.03em",
                  color: palette.text,
                }}
              >
                {title}
              </h1>
              {subtitle ? (
                <p
                  style={{
                    margin: "14px 0 0",
                    maxWidth: 760,
                    fontSize: 16,
                    lineHeight: 1.6,
                    color: palette.textMuted,
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
          padding: 8,
          borderRadius: 16,
          border: `1px solid ${palette.border}`,
          background: palette.surface,
          boxShadow: shadows.card,
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
                padding: "10px 16px",
                borderRadius: 12,
                fontSize: 15,
                fontWeight: 600,
                letterSpacing: "-0.01em",
                color: active ? palette.text : palette.textMuted,
                background: active
                  ? "linear-gradient(135deg, rgba(79, 70, 229, 0.12) 0%, rgba(56, 189, 248, 0.12) 100%)"
                  : "transparent",
                border: active ? "1px solid rgba(79, 70, 229, 0.14)" : "1px solid transparent",
                boxShadow: active ? shadows.glow : "none",
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
            color: palette.text,
          }}
        >
          {title}
        </h2>
        {description ? (
          <p style={{ margin: "8px 0 0", fontSize: 15, lineHeight: 1.6, color: palette.textMuted }}>{description}</p>
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
        borderRadius: 18,
        padding: 22,
        background: toneStyle.background,
        border: toneStyle.border,
        boxShadow: shadows.card,
        color: toneStyle.text,
        ...style,
      }}
    >
      <div>{children}</div>
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
          fontSize: 12,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          color: toneStyle.muted,
          marginBottom: 14,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: '"Space Grotesk", "Manrope", sans-serif',
          fontSize: 30,
          fontWeight: 700,
          lineHeight: 1.05,
          letterSpacing: "-0.03em",
          marginBottom: hint ? 10 : 0,
        }}
      >
        {value}
      </div>
      {hint ? <div style={{ fontSize: 15, color: toneStyle.muted, lineHeight: 1.6 }}>{hint}</div> : null}
    </Card>
  );
}

export function Badge({
  children,
  tone = "default",
}: PropsWithChildren<{ tone?: "default" | "success" | "warning" | "critical" | "accent" | "subtle" }>) {
  const styles: Record<string, CSSProperties> = {
    default: {
      background: "#f8fafc",
      color: palette.text,
      border: `1px solid ${palette.border}`,
    },
    subtle: {
      background: "#f1f5f9",
      color: palette.text,
      border: `1px solid ${palette.border}`,
    },
    success: {
      background: "rgba(19, 121, 91, 0.1)",
      color: palette.success,
      border: "1px solid rgba(19, 121, 91, 0.16)",
    },
    warning: {
      background: "rgba(180, 83, 9, 0.1)",
      color: palette.warning,
      border: "1px solid rgba(180, 83, 9, 0.16)",
    },
    critical: {
      background: "rgba(190, 18, 60, 0.1)",
      color: palette.critical,
      border: "1px solid rgba(190, 18, 60, 0.16)",
    },
    accent: {
      background: "linear-gradient(135deg, rgba(79, 70, 229, 0.12) 0%, rgba(56, 189, 248, 0.14) 100%)",
      color: palette.indigo,
      border: "1px solid rgba(79, 70, 229, 0.16)",
    },
  };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
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
            borderBottom: `1px solid ${palette.border}`,
          }}
        >
          <div style={{ fontSize: 14, color: palette.textMuted, lineHeight: 1.55 }}>{item.label}</div>
          <div style={{ fontSize: 14, fontWeight: 700, textAlign: "right", lineHeight: 1.5, color: palette.text }}>
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
          fontSize: 24,
          fontWeight: 700,
          letterSpacing: "-0.03em",
          marginBottom: 10,
          color: palette.text,
        }}
      >
        {title}
      </div>
      <div style={{ fontSize: 15, lineHeight: 1.6, color: palette.textMuted }}>{body}</div>
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
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: "-0.03em",
              marginBottom: 10,
              color: toneStyle.text,
            }}
          >
            {title}
          </div>
          <div style={{ fontSize: 15, lineHeight: 1.72, color: toneStyle.muted }}>{body}</div>
        </div>
        {actions ? <div style={{ display: "flex", alignItems: "center" }}>{actions}</div> : null}
      </div>
    </Card>
  );
}

export function InlineList({ items }: { items: string[] }) {
  return (
    <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.7, color: palette.textMuted }}>
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
