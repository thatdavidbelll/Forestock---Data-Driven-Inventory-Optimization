import type { ButtonHTMLAttributes, CSSProperties, PropsWithChildren, ReactNode } from "react";
import { useEffect, useState } from "react";
import { Link, isRouteErrorResponse } from "react-router";

type SurfaceTone = "default" | "primary" | "secondary" | "success" | "warning" | "danger" | "subtle";
type ActionTone = "primary" | "secondary";

/* ------------------------------------------------------------------ */
/*  Palette & Utilities                                                */
/* ------------------------------------------------------------------ */

const palette = {
  primary: "var(--fs-primary)",
  secondary: "var(--fs-secondary)",
  success: "var(--fs-success)",
  warning: "var(--fs-warning)",
  danger: "var(--fs-danger)",
  surface: "var(--fs-surface)",
  surfaceRaised: "var(--fs-surface-raised)",
  surfaceMuted: "var(--fs-surface-muted)",
  surfaceStrong: "var(--fs-surface-strong)",
  border: "var(--fs-border)",
  borderStrong: "var(--fs-border-strong)",
  text: "var(--fs-text)",
  textMuted: "var(--fs-text-muted)",
  textSoft: "var(--fs-text-soft)",
  shadowSm: "var(--fs-shadow-sm)",
  shadowMd: "var(--fs-shadow-md)",
  shadowLg: "var(--fs-shadow-lg)",
} as const;

const layoutWidth = 1180;

function paperFill(color: string) {
  return `linear-gradient(180deg, rgb(255 255 255 / 0.84) 0%, rgb(255 255 255 / 0.36) 22%, transparent 48%), ${color}`;
}

function toneColors(tone: SurfaceTone) {
  const mapping: Record<string, { background: string; border: string; text: string; muted: string }> = {
    primary: {
      background: paperFill("color-mix(in oklab, var(--fs-primary) 4%, var(--fs-surface))"),
      border: `1px solid ${palette.primary}`,
      text: palette.text,
      muted: palette.textMuted,
    },
    secondary: {
      background: paperFill("color-mix(in oklab, var(--fs-secondary) 7%, var(--fs-surface))"),
      border: `1px solid ${palette.secondary}`,
      text: palette.text,
      muted: palette.textMuted,
    },
    success: {
      background: paperFill("color-mix(in oklab, var(--fs-success) 6%, var(--fs-surface))"),
      border: `1px solid ${palette.success}`,
      text: palette.text,
      muted: palette.textMuted,
    },
    warning: {
      background: paperFill("color-mix(in oklab, var(--fs-warning) 7%, var(--fs-surface))"),
      border: `1px solid ${palette.warning}`,
      text: palette.text,
      muted: palette.textMuted,
    },
    danger: {
      background: paperFill("color-mix(in oklab, var(--fs-danger) 4%, var(--fs-surface))"),
      border: `1px solid ${palette.danger}`,
      text: palette.text,
      muted: palette.textMuted,
    },
    subtle: {
      background: paperFill(palette.surfaceMuted),
      border: `1px solid ${palette.border}`,
      text: palette.text,
      muted: palette.textMuted,
    },
    default: {
      background: paperFill(palette.surfaceRaised),
      border: `1px solid ${palette.border}`,
      text: palette.text,
      muted: palette.textMuted,
    },
  };

  return mapping[tone] || mapping.default;
}

/* ------------------------------------------------------------------ */
/*  Typography Helpers                                                 */
/* ------------------------------------------------------------------ */

function appHeadingStyle(size: 14 | 16 | 18 | 24 | 32 | 40): CSSProperties {
  const sizeMap = {
    14: "var(--text-sm)",
    16: "var(--text-body)",
    18: "var(--text-lg)",
    24: "var(--text-xl)",
    32: "var(--text-2xl)",
    40: "var(--text-3xl)",
  };

  return {
    margin: 0,
    fontFamily: "var(--font-heading)",
    fontSize: sizeMap[size],
    lineHeight: "var(--leading-tight)",
    letterSpacing: size >= 24 ? "-0.035em" : "-0.02em",
    color: palette.text,
    fontWeight: "var(--weight-bold)",
  };
}

/* ------------------------------------------------------------------ */
/*  Action Button Styles                                               */
/* ------------------------------------------------------------------ */

function actionStyle({
  tone = "primary",
  disabled = false,
  fullWidth = false,
}: {
  tone?: ActionTone;
  disabled?: boolean;
  fullWidth?: boolean;
}): CSSProperties {
  const secondary = tone === "secondary";

  return {
    display: "inline-flex",
    width: fullWidth ? "100%" : undefined,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 46,
    padding: "0 calc(var(--space-lg) + var(--space-xs))",
    borderRadius: 999,
    border: secondary ? `1px solid ${palette.borderStrong}` : `1px solid ${palette.primary}`,
    background: disabled
      ? paperFill(palette.surfaceStrong)
      : secondary
        ? paperFill(palette.surfaceRaised)
        : `linear-gradient(180deg, rgb(255 255 255 / 0.22), rgb(255 255 255 / 0) 46%), linear-gradient(180deg, var(--fs-primary), var(--fs-primary-strong))`,
    color: disabled ? palette.textSoft : secondary ? palette.text : palette.surface,
    textDecoration: "none",
    fontSize: "var(--text-sm)",
    fontWeight: "var(--weight-bold)",
    letterSpacing: "0.012em",
    cursor: disabled ? "default" : "pointer",
    transition: "transform var(--transition-fast), box-shadow var(--transition-fast), background var(--transition-fast), border-color var(--transition-fast), color var(--transition-fast)",
    boxShadow: disabled
      ? "none"
      : secondary
        ? `inset 0 1px 0 rgb(255 255 255 / 0.72), ${palette.shadowSm}`
        : "inset 0 1px 0 rgb(255 255 255 / 0.16), 0 18px 32px -24px color-mix(in oklab, var(--fs-primary) 62%, transparent)",
  };
}

/* ------------------------------------------------------------------ */
/*  App Shell                                                          */
/* ------------------------------------------------------------------ */

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
    <div data-fs-shell style={{ color: palette.text, background: "var(--fs-base)", minHeight: "100vh" }}>
      <div style={{ maxWidth: layoutWidth, margin: "0 auto", padding: "var(--space-xl) var(--space-lg) var(--space-4xl)" }}>
        <header style={{ marginBottom: "var(--space-2xl)" }}>
          <Card tone="subtle" style={{ padding: "var(--space-xl)", overflow: "hidden" }}>
            <div style={{ display: "grid", gap: "var(--space-xl)", position: "relative" }}>
              <div
                style={{
                  display: "flex",
                  gap: "var(--space-md)",
                  flexWrap: "wrap",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "var(--space-sm)",
                    width: "fit-content",
                    minHeight: "var(--space-2xl)",
                    padding: "0 var(--space-md)",
                    borderRadius: 999,
                    background: paperFill("color-mix(in oklab, var(--fs-primary) 5%, var(--fs-surface-raised))"),
                    border: `1px solid ${palette.borderStrong}`,
                    boxShadow: `inset 0 1px 0 rgb(255 255 255 / 0.68), ${palette.shadowSm}`,
                    fontSize: "var(--text-xs)",
                    fontWeight: "var(--weight-bold)",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: palette.primary,
                  }}
                >
                  Forestock
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "var(--text-xs)",
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: palette.textMuted,
                  }}
                >
                  Forecast / Restock
                </div>
              </div>
              <div
                style={{
                  display: "grid",
                  gap: "var(--space-lg)",
                  gridTemplateColumns: "repeat(auto-fit, minmax(min(280px, 100%), 1fr))",
                  alignItems: "start",
                }}
              >
                <div style={{ minWidth: 0, display: "grid", gap: "var(--space-md)" }}>
                  <div
                    style={{
                      width: 92,
                      height: 2,
                      borderRadius: 999,
                      background: "linear-gradient(90deg, color-mix(in oklab, var(--fs-secondary) 72%, white), color-mix(in oklab, var(--fs-primary) 52%, white))",
                    }}
                  />
                  <h1 style={{ ...appHeadingStyle(40), fontSize: "clamp(2.2rem, 4vw, 3.15rem)", maxWidth: "14ch" }}>{title}</h1>
                  {subtitle ? (
                    <p
                      style={{
                        margin: 0,
                        maxWidth: "62ch",
                        fontSize: "var(--text-body)",
                        lineHeight: "var(--leading-body)",
                        color: palette.textMuted,
                      }}
                    >
                      {subtitle}
                    </p>
                  ) : null}
                </div>
                {actions ? (
                  <div
                    style={{
                      display: "grid",
                      justifyItems: "end",
                      alignSelf: "end",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        gap: "var(--space-sm)",
                        flexWrap: "wrap",
                        justifyContent: "flex-end",
                        alignItems: "center",
                        padding: "var(--space-md)",
                        borderRadius: 22,
                        border: `1px solid ${palette.border}`,
                        background: paperFill("color-mix(in oklab, var(--fs-secondary) 8%, var(--fs-surface-raised))"),
                        boxShadow: `inset 0 1px 0 rgb(255 255 255 / 0.72), ${palette.shadowSm}`,
                      }}
                    >
                      {actions}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </Card>
        </header>
        <main style={{ display: "grid", gap: "var(--space-2xl)" }}>{children}</main>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Navigation Tabs                                                    */
/* ------------------------------------------------------------------ */

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
    <div style={{ maxWidth: layoutWidth, margin: "0 auto", padding: "var(--space-md) var(--space-lg) 0" }}>
      <nav
        aria-label="App navigation"
        style={{
          display: "flex",
          gap: "var(--space-xs)",
          flexWrap: "wrap",
          alignItems: "center",
          padding: "var(--space-sm)",
          borderRadius: 999,
          border: `1px solid ${palette.border}`,
          background: paperFill("color-mix(in oklab, var(--fs-secondary) 5%, var(--fs-surface-muted))"),
          boxShadow: `inset 0 1px 0 rgb(255 255 255 / 0.72), ${palette.shadowSm}`,
        }}
      >
        {items.map((item) => {
          const active = currentPath === item.href;
          const href = `${item.href}${search}`;
          return (
            <Link
              key={href}
              to={href}
              aria-current={active ? "page" : undefined}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: 42,
                padding: "0 calc(var(--space-lg) + var(--space-xs))",
                textDecoration: "none",
                whiteSpace: "nowrap",
                borderRadius: 999,
                border: active ? `1px solid ${palette.borderStrong}` : "1px solid transparent",
                fontSize: "var(--text-xs)",
                fontWeight: active ? "var(--weight-bold)" : "var(--weight-medium)",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: active ? palette.primary : palette.textMuted,
                background: active ? paperFill("color-mix(in oklab, var(--fs-primary) 4%, var(--fs-surface-raised))") : "transparent",
                boxShadow: active ? `inset 0 1px 0 rgb(255 255 255 / 0.74), ${palette.shadowSm}` : "none",
                transition: "background var(--transition-fast), color var(--transition-fast), border-color var(--transition-fast), transform var(--transition-fast), box-shadow var(--transition-fast)",
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  e.currentTarget.style.background = paperFill("color-mix(in oklab, var(--fs-primary) 3%, var(--fs-surface-raised))");
                  e.currentTarget.style.color = palette.primary;
                  e.currentTarget.style.transform = "translateY(-1px)";
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = palette.textMuted;
                  e.currentTarget.style.transform = "translateY(0)";
                }
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Section                                                            */
/* ------------------------------------------------------------------ */

export function Section({
  title,
  description,
  children,
}: PropsWithChildren<{ title: string; description?: string }>) {
  return (
    <section style={{ display: "grid", gap: "var(--space-lg)" }}>
      <div style={{ display: "grid", gap: "var(--space-xs)" }}>
        <div
          style={{
            width: 64,
            height: 2,
            borderRadius: 999,
            background: "var(--fs-accent-line)",
          }}
        />
        <h2 style={appHeadingStyle(24)}>{title}</h2>
        {description ? (
          <p style={{ margin: 0, maxWidth: "60ch", fontSize: "var(--text-sm)", lineHeight: "var(--leading-body)", color: palette.textMuted }}>
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Grid                                                               */
/* ------------------------------------------------------------------ */

export function Grid({
  columns = 2,
  children,
}: PropsWithChildren<{ columns?: 2 | 3 | 4 }>) {
  return (
    <div
      style={{
        display: "grid",
        gap: "var(--space-lg)",
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

/* ------------------------------------------------------------------ */
/*  Card                                                               */
/* ------------------------------------------------------------------ */

export function Card({
  children,
  tone = "default",
  style,
  interactive = false,
  onClick,
}: PropsWithChildren<{
  tone?: SurfaceTone;
  style?: CSSProperties;
  interactive?: boolean;
  onClick?: () => void;
}>) {
  const toneStyle = toneColors(tone);

  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      style={{
        borderRadius: 26,
        padding: "var(--space-lg)",
        background: toneStyle.background,
        border: toneStyle.border,
        color: toneStyle.text,
        boxShadow: `inset 0 1px 0 rgb(255 255 255 / 0.74), ${palette.shadowSm}`,
        cursor: interactive || onClick ? "pointer" : undefined,
        transition: interactive || onClick
          ? "transform var(--transition-fast), box-shadow var(--transition-fast), background var(--transition-fast)"
          : undefined,
        ...style,
      }}
      onMouseEnter={(e) => {
        if (interactive || onClick) {
          e.currentTarget.style.transform = "translateY(-1px)";
          e.currentTarget.style.boxShadow = `inset 0 1px 0 rgb(255 255 255 / 0.74), ${palette.shadowMd}`;
        }
      }}
      onMouseLeave={(e) => {
        if (interactive || onClick) {
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.boxShadow = `inset 0 1px 0 rgb(255 255 255 / 0.74), ${palette.shadowSm}`;
        }
      }}
    >
      {children}
    </div>
  );
}

export function InsetPanel({
  children,
  tone = "subtle",
  style,
}: PropsWithChildren<{
  tone?: SurfaceTone;
  style?: CSSProperties;
}>) {
  const toneStyle = toneColors(tone);

  return (
    <div
      style={{
        borderRadius: 20,
        padding: "var(--space-md) var(--space-lg)",
        background: toneStyle.background,
        border: toneStyle.border,
        color: toneStyle.text,
        boxShadow: "inset 0 1px 0 rgb(255 255 255 / 0.68)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Metric Card                                                        */
/* ------------------------------------------------------------------ */

export function MetricCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "primary" | "secondary" | "success" | "warning" | "danger" | "subtle";
}) {
  const toneStyle = toneColors(tone);

  return (
    <Card tone={tone} style={{ padding: "var(--space-md)", minHeight: "100%" }}>
      <div style={{ display: "grid", gap: "var(--space-sm)", alignContent: "space-between", minHeight: "100%" }}>
        <div
          style={{
            fontSize: "var(--text-xs)",
            fontWeight: "var(--weight-bold)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: toneStyle.muted,
          }}
        >
          {label}
        </div>
        <div style={{ ...appHeadingStyle(32), fontVariantNumeric: "tabular-nums" }}>{value}</div>
        {hint ? <div style={{ fontSize: "var(--text-sm)", lineHeight: "var(--leading-body)", color: toneStyle.muted }}>{hint}</div> : null}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Badge / Chip                                                       */
/* ------------------------------------------------------------------ */

export function Badge({
  children,
  tone = "default",
}: PropsWithChildren<{ tone?: SurfaceTone }>) {
  const colorMap: Record<string, { bg: string; text: string; border: string }> = {
    primary: { bg: `linear-gradient(180deg, rgb(255 255 255 / 0.18), rgb(255 255 255 / 0) 45%), ${palette.primary}`, text: palette.surface, border: palette.primary },
    secondary: { bg: paperFill("color-mix(in oklab, var(--fs-secondary) 10%, var(--fs-surface))"), text: palette.secondary, border: palette.secondary },
    success: { bg: paperFill("color-mix(in oklab, var(--fs-success) 9%, var(--fs-surface))"), text: palette.success, border: palette.success },
    warning: { bg: paperFill("color-mix(in oklab, var(--fs-warning) 9%, var(--fs-surface))"), text: palette.warning, border: palette.warning },
    danger: { bg: paperFill("color-mix(in oklab, var(--fs-danger) 8%, var(--fs-surface))"), text: palette.danger, border: palette.danger },
    subtle: { bg: paperFill(palette.surfaceStrong), text: palette.textMuted, border: palette.border },
    default: { bg: paperFill(palette.surfaceRaised), text: palette.text, border: palette.border },
  };

  const { bg, text, border } = colorMap[tone] || colorMap.default;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--space-xs)",
        minHeight: 30,
        padding: "0 var(--space-md)",
        borderRadius: "var(--space-xs)",
        fontSize: "var(--text-xs)",
        fontWeight: "var(--weight-bold)",
        lineHeight: 1,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        background: bg,
        color: text,
        border: `1px solid ${border}`,
        boxShadow: "inset 0 1px 0 rgb(255 255 255 / 0.58)",
      }}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Buttons                                                            */
/* ------------------------------------------------------------------ */

export function LinkButton({
  to,
  children,
  tone = "primary",
}: PropsWithChildren<{ to: string; tone?: ActionTone }>) {
  return (
    <Link to={to} style={actionStyle({ tone })}>
      {children}
    </Link>
  );
}

export function AnchorButton({
  href,
  children,
  tone = "primary",
  target,
  rel,
}: PropsWithChildren<{ href: string; tone?: ActionTone; target?: string; rel?: string }>) {
  return (
    <a href={href} target={target} rel={rel} style={actionStyle({ tone })}>
      {children}
    </a>
  );
}

export function PlainButton({
  children,
  tone = "primary",
  ...props
}: PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement> & { tone?: ActionTone }>) {
  return (
    <button {...props} style={{ ...actionStyle({ tone, disabled: props.disabled }), ...(props.style ?? {}) }}>
      {children}
    </button>
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

/* ------------------------------------------------------------------ */
/*  KeyValue List                                                      */
/* ------------------------------------------------------------------ */

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
            gap: "var(--space-sm)",
            gridTemplateColumns: "minmax(96px, 124px) minmax(0, 1fr)",
            alignItems: "start",
            padding: "var(--space-md) 0",
            borderBottom: index === items.length - 1 ? "none" : `1px solid ${palette.border}`,
          }}
        >
          <div style={{ fontSize: "var(--text-xs)", lineHeight: "var(--leading-body)", letterSpacing: "0.06em", textTransform: "uppercase", color: palette.textMuted }}>{item.label}</div>
          <div
            style={{
              fontSize: "var(--text-body)",
              fontWeight: "var(--weight-semibold)",
              lineHeight: "var(--leading-body)",
              color: palette.text,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Empty State                                                        */
/* ------------------------------------------------------------------ */

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <Card tone="subtle" style={{ padding: "var(--space-xl)" }}>
      <div style={{ display: "grid", gap: "var(--space-sm)", maxWidth: "60ch" }}>
        <div style={appHeadingStyle(24)}>{title}</div>
        <div style={{ fontSize: "var(--text-body)", lineHeight: "var(--leading-body)", color: palette.textMuted }}>{body}</div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Info Banner                                                        */
/* ------------------------------------------------------------------ */

export function InfoBanner({
  title,
  body,
  tone = "primary",
  actions,
}: {
  title: string;
  body: ReactNode;
  tone?: "primary" | "secondary" | "success" | "warning" | "danger" | "subtle";
  actions?: ReactNode;
}) {
  const toneStyle = toneColors(tone);

  return (
    <Card tone={tone} style={{ padding: "var(--space-md)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-lg)", flexWrap: "wrap", alignItems: "start" }}>
        <div style={{ display: "grid", gap: "var(--space-xs)", maxWidth: "68ch" }}>
          <div style={{ ...appHeadingStyle(18), color: toneStyle.text }}>{title}</div>
          <div style={{ fontSize: "var(--text-sm)", lineHeight: "var(--leading-body)", color: toneStyle.muted }}>{body}</div>
        </div>
        {actions ? <div style={{ display: "flex", gap: "var(--space-sm)", flexWrap: "wrap" }}>{actions}</div> : null}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Inline List                                                        */
/* ------------------------------------------------------------------ */

export function InlineList({ items }: { items: string[] }) {
  return (
    <ul style={{ margin: 0, paddingLeft: "var(--space-lg)", fontSize: "var(--text-sm)", lineHeight: "var(--leading-body)", color: palette.textMuted }}>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/*  Date / Time Helpers                                                */
/* ------------------------------------------------------------------ */

function stableDateTimeLabel(value: string | null | undefined) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(date)
    .replace(",", "");
}

function stableDateLabel(value: string | null | undefined) {
  if (!value) return "Not available";
  return value;
}

export function DateTimeText({ value }: { value: string | null | undefined }) {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  if (!value) return <>Not available</>;

  const formatted = hydrated ? new Date(value).toLocaleString() : stableDateTimeLabel(value);
  return <span suppressHydrationWarning style={{ fontFamily: "var(--font-mono)" }}>{formatted}</span>;
}

export function DateText({ value }: { value: string | null | undefined }) {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  if (!value) return <>Not available</>;

  let formatted = stableDateLabel(value);
  if (hydrated) {
    const [year, month, day] = value.split("-").map(Number);
    if (year && month && day) {
      formatted = new Date(year, month - 1, day).toLocaleDateString();
    }
  }

  return <span suppressHydrationWarning style={{ fontFamily: "var(--font-mono)" }}>{formatted}</span>;
}

/* ------------------------------------------------------------------ */
/*  Tone Helpers                                                       */
/* ------------------------------------------------------------------ */

export function toneForForecast(
  status: string | null | undefined,
): "default" | "success" | "warning" | "danger" | "primary" {
  if (!status) return "warning";
  const normalized = status.toUpperCase();
  if (normalized.includes("COMPLETED")) return "success";
  if (normalized.includes("RUNNING") || normalized.includes("PENDING")) return "primary";
  if (normalized.includes("FAILED") || normalized.includes("ERROR")) return "danger";
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
}): { label: string; tone: "success" | "warning" | "danger" | "primary" } {
  if (forecastStatus?.toUpperCase().includes("COMPLETED") && activeProductCount > 0 && hasSalesHistory) {
    return { label: "Ready", tone: "success" };
  }
  if (forecastStatus?.toUpperCase().includes("RUNNING") || forecastStatus?.toUpperCase().includes("PENDING")) {
    return { label: "Forecast running", tone: "primary" };
  }
  if (activeProductCount > 0 || hasSalesHistory) {
    return { label: "Needs attention", tone: "warning" };
  }
  return { label: "Needs setup", tone: "danger" };
}

export function toneForBoolean(value: boolean, positiveTone: "success" | "primary" = "success") {
  return value ? positiveTone : "warning";
}

/* ------------------------------------------------------------------ */
/*  Form Primitives                                                    */
/* ------------------------------------------------------------------ */

export function FieldLabel({ htmlFor, children }: { htmlFor?: string; children: ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      style={{
        display: "block",
        marginBottom: "var(--space-sm)",
        fontSize: "var(--text-sm)",
        fontWeight: "var(--weight-bold)",
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
        accentColor: palette.primary,
        cursor: "pointer",
      }}
    />
  );
}

export function InputFrame({ children }: PropsWithChildren) {
  return (
    <div
      style={{
        borderRadius: 24,
        border: `1px solid ${palette.border}`,
        background: paperFill("color-mix(in oklab, var(--fs-secondary) 5%, var(--fs-surface-muted))"),
        padding: "var(--space-lg)",
        boxShadow: "inset 0 1px 0 rgb(255 255 255 / 0.68)",
      }}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Value Pill                                                         */
/* ------------------------------------------------------------------ */

export function ValuePill({ children }: PropsWithChildren) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        minHeight: "var(--space-2xl)",
        padding: "0 var(--space-md)",
        borderRadius: 999,
        background: paperFill("color-mix(in oklab, var(--fs-primary) 7%, var(--fs-surface))"),
        color: palette.primary,
        fontSize: "var(--text-sm)",
        fontWeight: "var(--weight-bold)",
        border: `1px solid ${palette.border}`,
        boxShadow: "inset 0 1px 0 rgb(255 255 255 / 0.72)",
      }}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Summary Split                                                      */
/* ------------------------------------------------------------------ */

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
        gap: "var(--space-xl)",
        gridTemplateColumns: aside ? "repeat(auto-fit, minmax(min(260px, 100%), 1fr))" : "1fr",
        alignItems: "start",
      }}
    >
      <div style={{ display: "grid", gap: "var(--space-sm)" }}>
        <div style={appHeadingStyle(24)}>{title}</div>
        <div style={{ fontSize: "var(--text-body)", lineHeight: "var(--leading-body)", color: palette.textMuted }}>{body}</div>
      </div>
      {aside ? <div>{aside}</div> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Skeleton                                                           */
/* ------------------------------------------------------------------ */

export function Skeleton({
  lines = 1,
  width = "100%",
  height = "1em",
  style,
}: {
  lines?: number;
  width?: string | number;
  height?: string | number;
  style?: CSSProperties;
}) {
  return (
    <div style={{ display: "grid", gap: "var(--space-sm)", width }}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          style={{
            height,
            borderRadius: 6,
            background: `linear-gradient(90deg, ${palette.surfaceMuted} 25%, ${palette.surfaceRaised} 50%, ${palette.surfaceMuted} 75%)`,
            backgroundSize: "200% 100%",
            animation: "paper-skeleton 1.4s ease infinite",
            ...style,
          }}
        />
      ))}
      <style>{`
        @keyframes paper-skeleton {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Error Handling                                                     */
/* ------------------------------------------------------------------ */

export function getErrorMessage(error: unknown) {
  if (isRouteErrorResponse(error)) {
    if (typeof error.data === "string" && error.data.trim()) {
      return error.data;
    }
    if (error.data && typeof error.data === "object" && "message" in error.data) {
      const message = (error.data as { message?: unknown }).message;
      if (typeof message === "string" && message.trim()) {
        return message;
      }
    }
    return error.statusText || `Request failed with status ${error.status}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Something went wrong while loading this page.";
}

export function ErrorState({
  title = "Something went wrong",
  error,
}: {
  title?: string;
  error: unknown;
}) {
  return (
    <AppShell
      title={title}
      subtitle="Forestock could not load this screen inside Shopify Admin."
      actions={<Badge tone="danger">Load failed</Badge>}
    >
      <Card tone="danger" style={{ maxWidth: 780 }}>
        <div style={{ display: "grid", gap: "var(--space-sm)" }}>
          <div style={appHeadingStyle(24)}>{getErrorMessage(error)}</div>
          <div style={{ fontSize: "var(--text-sm)", lineHeight: "var(--leading-body)", color: palette.textMuted }}>
            Refresh the app first. If the problem keeps happening, check the Shopify connection and the Forestock backend.
          </div>
          {isRouteErrorResponse(error) ? (
            <div style={{ fontSize: "var(--text-xs)", color: palette.textMuted }}>
              Status: {error.status} {error.statusText}
            </div>
          ) : null}
        </div>
      </Card>
    </AppShell>
  );
}
