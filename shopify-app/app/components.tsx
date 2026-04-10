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
  shell: "0 18px 40px rgba(17, 24, 39, 0.04)",
  card: "0 8px 24px rgba(17, 24, 39, 0.04)",
  focus: "0 0 0 4px rgba(79, 70, 229, 0.12)",
};

const layoutWidth = 1160;

function toneColors(tone: "default" | "accent" | "success" | "warning" | "critical" | "subtle") {
  if (tone === "accent") {
    return {
      background: "rgba(79, 70, 229, 0.05)",
      border: "1px solid rgba(79, 70, 229, 0.12)",
      text: palette.text,
      muted: palette.textMuted,
    };
  }
  if (tone === "success") {
    return {
      background: "rgba(31, 122, 92, 0.06)",
      border: "1px solid rgba(31, 122, 92, 0.12)",
      text: palette.text,
      muted: palette.textMuted,
    };
  }
  if (tone === "warning") {
    return {
      background: "rgba(161, 98, 7, 0.06)",
      border: "1px solid rgba(161, 98, 7, 0.12)",
      text: palette.text,
      muted: palette.textMuted,
    };
  }
  if (tone === "critical") {
    return {
      background: "rgba(180, 35, 24, 0.05)",
      border: "1px solid rgba(180, 35, 24, 0.12)",
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
    <div style={{ color: palette.text }}>
      <div style={{ maxWidth: layoutWidth, margin: "0 auto", padding: "0 20px 56px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            gap: 20,
            flexWrap: "wrap",
            padding: "14px 2px 30px",
          }}
        >
          <div style={{ maxWidth: 760 }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 12,
                color: palette.textMuted,
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              <span
                style={{
                  width: 28,
                  height: 1,
                  background: "rgba(79, 70, 229, 0.3)",
                }}
              />
              Forestock
            </div>
            <h1
              style={{
                margin: 0,
                fontFamily: '"Space Grotesk", "Manrope", sans-serif',
                fontSize: "clamp(2rem, 4vw, 3.4rem)",
                lineHeight: 1,
                letterSpacing: "-0.045em",
                color: palette.text,
              }}
            >
              {title}
            </h1>
            {subtitle ? (
              <p
                style={{
                  margin: "14px 0 0",
                  maxWidth: 680,
                  fontSize: 16,
                  lineHeight: 1.65,
                  color: palette.textMuted,
                }}
              >
                {subtitle}
              </p>
            ) : null}
          </div>
          {actions ? <div style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 40 }}>{actions}</div> : null}
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
    <div style={{ maxWidth: layoutWidth, margin: "0 auto", padding: "20px 20px 0" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 14,
          flexWrap: "wrap",
          padding: 10,
          borderRadius: 20,
          border: `1px solid rgba(229, 231, 235, 0.92)`,
          background: "rgba(255, 255, 255, 0.86)",
          boxShadow: shadows.shell,
          backdropFilter: "blur(14px)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, color: palette.text, fontWeight: 700 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 12,
              background: "rgba(79, 70, 229, 0.08)",
              color: palette.indigo,
              display: "grid",
              placeItems: "center",
              fontSize: 14,
              fontWeight: 800,
            }}
          >
            F
          </div>
          <span style={{ fontSize: 14, letterSpacing: "-0.01em" }}>Forestock</span>
        </div>
        <div
          style={{
            display: "inline-flex",
            gap: 6,
            flexWrap: "wrap",
            padding: 4,
            borderRadius: 14,
            background: palette.surfaceMuted,
            border: `1px solid ${palette.border}`,
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
                  padding: "10px 14px",
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: active ? 700 : 600,
                  color: active ? palette.text : palette.textMuted,
                  background: active ? palette.surface : "transparent",
                  border: active ? `1px solid ${palette.border}` : "1px solid transparent",
                  boxShadow: active ? shadows.card : "none",
                }}
              >
                {item.label}
              </a>
            );
          })}
        </div>
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
    <section style={{ marginBottom: 28 }}>
      <div style={{ marginBottom: 14 }}>
        <h2
          style={{
            margin: 0,
            fontFamily: '"Space Grotesk", "Manrope", sans-serif',
            fontSize: 20,
            lineHeight: 1.15,
            letterSpacing: "-0.03em",
            color: palette.text,
          }}
        >
          {title}
        </h2>
        {description ? (
          <p style={{ margin: "8px 0 0", fontSize: 14, lineHeight: 1.65, color: palette.textMuted }}>{description}</p>
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
            ? "repeat(auto-fit, minmax(180px, 1fr))"
            : columns === 3
              ? "repeat(auto-fit, minmax(220px, 1fr))"
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
  const toneStyle = toneColors(tone);

  return (
    <div
      style={{
        borderRadius: 20,
        padding: 22,
        background: toneStyle.background,
        border: toneStyle.border,
        boxShadow: tone === "default" || tone === "subtle" ? shadows.card : "none",
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
    <Card tone={tone} style={{ padding: 20 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: toneStyle.muted,
          marginBottom: 12,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: '"Space Grotesk", "Manrope", sans-serif',
          fontSize: 28,
          fontWeight: 700,
          lineHeight: 1.02,
          letterSpacing: "-0.04em",
          marginBottom: hint ? 8 : 0,
        }}
      >
        {value}
      </div>
      {hint ? <div style={{ fontSize: 14, color: toneStyle.muted, lineHeight: 1.6 }}>{hint}</div> : null}
    </Card>
  );
}

export function Badge({
  children,
  tone = "default",
}: PropsWithChildren<{ tone?: "default" | "success" | "warning" | "critical" | "accent" | "subtle" }>) {
  const styles: Record<string, CSSProperties> = {
    default: {
      background: palette.surface,
      color: palette.text,
      border: `1px solid ${palette.border}`,
    },
    subtle: {
      background: palette.surfaceMuted,
      color: palette.textMuted,
      border: `1px solid ${palette.border}`,
    },
    success: {
      background: "rgba(31, 122, 92, 0.08)",
      color: palette.success,
      border: "1px solid rgba(31, 122, 92, 0.12)",
    },
    warning: {
      background: "rgba(161, 98, 7, 0.08)",
      color: palette.warning,
      border: "1px solid rgba(161, 98, 7, 0.12)",
    },
    critical: {
      background: "rgba(180, 35, 24, 0.08)",
      color: palette.critical,
      border: "1px solid rgba(180, 35, 24, 0.12)",
    },
    accent: {
      background: "rgba(79, 70, 229, 0.08)",
      color: palette.indigo,
      border: "1px solid rgba(79, 70, 229, 0.12)",
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
        fontSize: 11,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
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
    <div style={{ display: "grid", gap: 0 }}>
      {items.map((item, index) => (
        <div
          key={`${item.label}-${index}`}
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) auto",
            gap: 14,
            alignItems: "start",
            padding: "12px 0",
            borderBottom: index === items.length - 1 ? "none" : `1px solid ${palette.border}`,
          }}
        >
          <div style={{ fontSize: 13, color: palette.textMuted, lineHeight: 1.55 }}>{item.label}</div>
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
    <Card tone="subtle" style={{ padding: 28 }}>
      <div
        style={{
          fontFamily: '"Space Grotesk", "Manrope", sans-serif',
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: "-0.03em",
          marginBottom: 10,
          color: palette.text,
        }}
      >
        {title}
      </div>
      <div style={{ maxWidth: 560, fontSize: 15, lineHeight: 1.7, color: palette.textMuted }}>{body}</div>
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
    <Card tone={tone} style={{ marginBottom: 24, padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 18, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div style={{ maxWidth: 820 }}>
          <div
            style={{
              fontFamily: '"Space Grotesk", "Manrope", sans-serif',
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: "-0.03em",
              marginBottom: 8,
              color: toneStyle.text,
            }}
          >
            {title}
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.7, color: toneStyle.muted }}>{body}</div>
        </div>
        {actions ? <div style={{ display: "flex", alignItems: "center" }}>{actions}</div> : null}
      </div>
    </Card>
  );
}

export function InlineList({ items }: { items: string[] }) {
  return (
    <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7, color: palette.textMuted, fontSize: 14 }}>
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

export function FieldLabel({ htmlFor, children }: { htmlFor?: string; children: ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      style={{
        display: "block",
        marginBottom: 10,
        fontSize: 13,
        fontWeight: 700,
        letterSpacing: "-0.01em",
        color: palette.text,
      }}
    >
      {children}
    </label>
  );
}

export function RangeInput({
  id,
  name,
  min,
  max,
  step = 1,
  value,
  onChange,
}: {
  id: string;
  name: string;
  min: string;
  max: string;
  step?: string | number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <input
      id={id}
      name={name}
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(event) => onChange(Number(event.currentTarget.value))}
      style={{
        width: "100%",
        accentColor: palette.indigo,
        cursor: "pointer",
      }}
    />
  );
}

export function InputFrame({ children }: PropsWithChildren) {
  return (
    <div
      style={{
        borderRadius: 18,
        border: `1px solid ${palette.border}`,
        background: palette.surfaceMuted,
        padding: 18,
      }}
    >
      {children}
    </div>
  );
}

export function ValuePill({ children }: PropsWithChildren) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "10px 14px",
        borderRadius: 999,
        background: "rgba(79, 70, 229, 0.08)",
        color: palette.indigo,
        fontSize: 14,
        fontWeight: 700,
      }}
    >
      {children}
    </div>
  );
}

export function SummarySplit({
  title,
  body,
  aside,
}: {
  title: ReactNode;
  body: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div
      style={{
        display: "grid",
        gap: 18,
        gridTemplateColumns: aside ? "minmax(0, 1.3fr) minmax(220px, 0.7fr)" : "1fr",
        alignItems: "start",
      }}
    >
      <div>
        <div
          style={{
            fontFamily: '"Space Grotesk", "Manrope", sans-serif',
            fontSize: 24,
            lineHeight: 1.06,
            letterSpacing: "-0.04em",
            fontWeight: 700,
            color: palette.text,
            marginBottom: 10,
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: 15, lineHeight: 1.7, color: palette.textMuted }}>{body}</div>
      </div>
      {aside ? <div>{aside}</div> : null}
    </div>
  );
}
