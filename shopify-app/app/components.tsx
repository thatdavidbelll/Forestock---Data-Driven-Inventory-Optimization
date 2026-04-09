import type { CSSProperties, PropsWithChildren, ReactNode } from "react";

const palette = {
  bg: "#f5f7fb",
  surface: "#ffffff",
  surfaceAlt: "#edf4f7",
  border: "#d9e2ec",
  text: "#102a43",
  muted: "#52606d",
  primary: "#183b56",
  accent: "#0f9d8a",
  accentSoft: "#e6f6f4",
  warning: "#b7791f",
  warningSoft: "#fff7e6",
  critical: "#d64545",
  criticalSoft: "#fdecec",
  success: "#1f7a4f",
  successSoft: "#eaf7ef",
};

const shadows = {
  card: "0 10px 30px rgba(15, 23, 42, 0.06)",
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
    <div style={{ background: palette.bg, minHeight: "100vh", color: palette.text }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "24px 20px 48px" }}>
        <header
          style={{
            background: `linear-gradient(135deg, ${palette.primary} 0%, #24506f 100%)`,
            color: "white",
            borderRadius: 24,
            padding: "24px 24px 20px",
            boxShadow: shadows.card,
            marginBottom: 20,
          }}
        >
          <div style={{ display: "flex", gap: 16, justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.75, fontWeight: 700 }}>
                Forestock for Shopify
              </div>
              <h1 style={{ margin: "8px 0 10px", fontSize: 30, lineHeight: 1.15 }}>{title}</h1>
              {subtitle ? <p style={{ margin: 0, maxWidth: 760, color: "rgba(255,255,255,0.86)", fontSize: 15 }}>{subtitle}</p> : null}
            </div>
            {actions ? <div>{actions}</div> : null}
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}

export function NavTabs({ items, currentPath }: { items: Array<{ label: string; href: string }>; currentPath: string }) {
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
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
              fontWeight: 700,
              fontSize: 14,
              color: active ? "white" : palette.primary,
              background: active ? palette.primary : "white",
              border: `1px solid ${active ? palette.primary : palette.border}`,
              boxShadow: active ? shadows.card : "none",
            }}
          >
            {item.label}
          </a>
        );
      })}
    </div>
  );
}

export function Section({ title, description, children }: PropsWithChildren<{ title: string; description?: string }>) {
  return (
    <section style={{ marginBottom: 20 }}>
      <div style={{ marginBottom: 12 }}>
        <h2 style={{ margin: "0 0 6px", fontSize: 21 }}>{title}</h2>
        {description ? <p style={{ margin: 0, color: palette.muted, fontSize: 14 }}>{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function Grid({ columns = 2, children }: PropsWithChildren<{ columns?: 2 | 3 | 4 }>) {
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

export function Card({ children, tone = "default", style }: PropsWithChildren<{ tone?: "default" | "accent" | "success" | "warning" | "critical" | "subtle"; style?: CSSProperties }>) {
  const toneStyles: Record<string, CSSProperties> = {
    default: { background: palette.surface, border: `1px solid ${palette.border}` },
    accent: { background: palette.accentSoft, border: `1px solid #bfeae3` },
    success: { background: palette.successSoft, border: `1px solid #c9e9d4` },
    warning: { background: palette.warningSoft, border: `1px solid #f0d8a7` },
    critical: { background: palette.criticalSoft, border: `1px solid #f2b5b5` },
    subtle: { background: palette.surfaceAlt, border: `1px solid ${palette.border}` },
  };

  return (
    <div
      style={{
        borderRadius: 20,
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

export function MetricCard({ label, value, hint, tone = "default" }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "default" | "accent" | "success" | "warning" | "critical" | "subtle" }) {
  return (
    <Card tone={tone}>
      <div style={{ fontSize: 13, fontWeight: 700, color: palette.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {label}
      </div>
      <div style={{ fontSize: 32, fontWeight: 800, lineHeight: 1.1, marginBottom: hint ? 8 : 0 }}>{value}</div>
      {hint ? <div style={{ fontSize: 14, color: palette.muted }}>{hint}</div> : null}
    </Card>
  );
}

export function Badge({ children, tone = "default" }: PropsWithChildren<{ tone?: "default" | "success" | "warning" | "critical" | "accent" }>) {
  const styles: Record<string, CSSProperties> = {
    default: { background: "#eef2f6", color: palette.primary },
    success: { background: palette.successSoft, color: palette.success },
    warning: { background: palette.warningSoft, color: palette.warning },
    critical: { background: palette.criticalSoft, color: palette.critical },
    accent: { background: palette.accentSoft, color: palette.accent },
  };

  return (
    <span style={{ display: "inline-flex", alignItems: "center", padding: "6px 10px", borderRadius: 999, fontSize: 12, fontWeight: 800, ...styles[tone] }}>
      {children}
    </span>
  );
}

export function KeyValueList({ items }: { items: Array<{ label: string; value: ReactNode }> }) {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {items.map((item) => (
        <div key={item.label} style={{ display: "flex", justifyContent: "space-between", gap: 16, borderBottom: `1px solid ${palette.border}`, paddingBottom: 10 }}>
          <div style={{ color: palette.muted, fontSize: 14 }}>{item.label}</div>
          <div style={{ fontSize: 14, fontWeight: 700, textAlign: "right" }}>{item.value}</div>
        </div>
      ))}
    </div>
  );
}

export function ActionButton({ children, loading, tone = "primary" }: PropsWithChildren<{ loading?: boolean; tone?: "primary" | "secondary" }>) {
  return (
    <s-button
      type="submit"
      loading={loading}
      variant={tone === "secondary" ? "secondary" : undefined}
    >
      {loading ? "Running..." : children}
    </s-button>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <Card tone="subtle">
      <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>{title}</div>
      <div style={{ color: palette.muted, lineHeight: 1.6 }}>{body}</div>
    </Card>
  );
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "Not available";
  return new Date(value).toLocaleString();
}

export function toneForForecast(status: string | null | undefined): "default" | "success" | "warning" | "critical" | "accent" {
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
    return { label: "Forecast ready", tone: "success" };
  }
  if (activeProductCount > 0 || hasSalesHistory) {
    return { label: "Needs completion", tone: "warning" };
  }
  return { label: "Needs setup", tone: "critical" };
}
