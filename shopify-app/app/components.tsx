import type { CSSProperties, PropsWithChildren, ReactNode } from "react";

const palette = {
  appBg: "#f6f6f7",
  surface: "#ffffff",
  surfaceSubtle: "#f1f2f4",
  border: "#d2d5d9",
  borderStrong: "#8c9196",
  text: "#202223",
  muted: "#6d7175",
  blue: "#005bd3",
  blueSoft: "#edf4ff",
  green: "#008060",
  greenSoft: "#e3f1df",
  amber: "#b98900",
  amberSoft: "#fef5ea",
  red: "#d82c0d",
  redSoft: "#fff1f1",
  ink: "#111827",
};

const shadows = {
  card: "0 1px 0 rgba(22, 29, 37, 0.05), 0 2px 8px rgba(22, 29, 37, 0.06)",
};

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
    <div style={{ background: palette.appBg, minHeight: "100vh", color: palette.text }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 20px 40px" }}>
        <div
          style={{
            background: palette.surface,
            border: `1px solid ${palette.border}`,
            borderRadius: 18,
            padding: "24px 24px 20px",
            boxShadow: shadows.card,
            marginBottom: 20,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: palette.muted,
                  marginBottom: 10,
                }}
              >
                Forestock embedded app
              </div>
              <h1
                style={{
                  margin: 0,
                  fontSize: 30,
                  lineHeight: 1.1,
                  color: palette.ink,
                }}
              >
                {title}
              </h1>
              {subtitle ? (
                <p
                  style={{
                    margin: "10px 0 0",
                    maxWidth: 760,
                    fontSize: 15,
                    lineHeight: 1.6,
                    color: palette.muted,
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
}: {
  items: Array<{ label: string; href: string }>;
  currentPath: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        flexWrap: "wrap",
        margin: "20px auto 16px",
        maxWidth: 1200,
        padding: "0 20px",
      }}
    >
      {items.map((item) => {
        const active = currentPath === item.href;
        return (
          <a
            key={item.href}
            href={item.href}
            style={{
              textDecoration: "none",
              padding: "10px 14px",
              borderRadius: 999,
              fontSize: 14,
              fontWeight: 700,
              color: active ? palette.blue : palette.text,
              background: active ? palette.blueSoft : palette.surface,
              border: `1px solid ${active ? "#bfdbfe" : palette.border}`,
              boxShadow: active ? "inset 0 0 0 1px rgba(0, 91, 211, 0.08)" : "none",
            }}
          >
            {item.label}
          </a>
        );
      })}
    </div>
  );
}

export function Section({
  title,
  description,
  children,
}: PropsWithChildren<{ title: string; description?: string }>) {
  return (
    <section style={{ marginBottom: 20 }}>
      <div style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 20, lineHeight: 1.2 }}>{title}</h2>
        {description ? (
          <p style={{ margin: "6px 0 0", fontSize: 14, lineHeight: 1.6, color: palette.muted }}>
            {description}
          </p>
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
        gap: 16,
        gridTemplateColumns:
          columns === 4
            ? "repeat(auto-fit, minmax(200px, 1fr))"
            : columns === 3
              ? "repeat(auto-fit, minmax(240px, 1fr))"
              : "repeat(auto-fit, minmax(280px, 1fr))",
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
  const toneStyles: Record<string, CSSProperties> = {
    default: { background: palette.surface, border: `1px solid ${palette.border}` },
    accent: { background: palette.blueSoft, border: "1px solid #bfdbfe" },
    success: { background: palette.greenSoft, border: "1px solid #bad8b0" },
    warning: { background: palette.amberSoft, border: "1px solid #f1d4a0" },
    critical: { background: palette.redSoft, border: "1px solid #f2b8b5" },
    subtle: { background: palette.surfaceSubtle, border: `1px solid ${palette.border}` },
  };

  return (
    <div
      style={{
        borderRadius: 16,
        padding: 18,
        boxShadow: shadows.card,
        ...toneStyles[tone],
        ...style,
      }}
    >
      {children}
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
  return (
    <Card tone={tone}>
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: palette.muted,
          marginBottom: 10,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.1, marginBottom: hint ? 8 : 0 }}>{value}</div>
      {hint ? <div style={{ fontSize: 14, color: palette.muted, lineHeight: 1.5 }}>{hint}</div> : null}
    </Card>
  );
}

export function Badge({
  children,
  tone = "default",
}: PropsWithChildren<{ tone?: "default" | "success" | "warning" | "critical" | "accent" | "subtle" }>) {
  const styles: Record<string, CSSProperties> = {
    default: { background: "#eef0f1", color: palette.text },
    subtle: { background: palette.surfaceSubtle, color: palette.text },
    success: { background: palette.greenSoft, color: palette.green },
    warning: { background: palette.amberSoft, color: palette.amber },
    critical: { background: palette.redSoft, color: palette.red },
    accent: { background: palette.blueSoft, color: palette.blue },
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
        fontWeight: 800,
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
            gap: 16,
            paddingBottom: 10,
            borderBottom: `1px solid ${palette.border}`,
          }}
        >
          <div style={{ fontSize: 14, color: palette.muted }}>{item.label}</div>
          <div style={{ fontSize: 14, fontWeight: 700, textAlign: "right" }}>{item.value}</div>
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
      <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 14, lineHeight: 1.6, color: palette.muted }}>{body}</div>
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
  return (
    <Card tone={tone} style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>{title}</div>
          <div style={{ fontSize: 14, lineHeight: 1.6, color: tone === "subtle" ? palette.muted : palette.text }}>{body}</div>
        </div>
        {actions ? <div style={{ display: "flex", alignItems: "center" }}>{actions}</div> : null}
      </div>
    </Card>
  );
}

export function InlineList({ items }: { items: string[] }) {
  return (
    <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
      {items.map((item) => (
        <li key={item}>{item}</li>
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
