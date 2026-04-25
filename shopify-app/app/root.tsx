import { Links, Meta, Outlet, Scripts, ScrollRestoration, data, useLoaderData } from "react-router";

export async function loader() {
  return data({
    shopifyApiKey: process.env.SHOPIFY_API_KEY ?? null,
  });
}

export default function App() {
  const { shopifyApiKey } = useLoaderData<typeof loader>();

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
        {shopifyApiKey ? <meta name="shopify-api-key" content={shopifyApiKey} /> : null}
        <script src="https://cdn.shopify.com/shopifycloud/app-bridge.js"></script>
        <link rel="preconnect" href="https://cdn.shopify.com/" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Azeret+Mono:wght@400..700&family=Public+Sans:wght@100..900&family=Red+Hat+Display:wght@400..900&display=swap"
          rel="stylesheet"
        />
        <style>{`
          :root {
            --fs-primary: oklch(0.36 0.07 155);
            --fs-primary-strong: oklch(0.28 0.05 155);
            --fs-secondary: oklch(0.72 0.09 78);
            --fs-success: oklch(0.62 0.12 150);
            --fs-warning: oklch(0.72 0.14 76);
            --fs-danger: oklch(0.61 0.16 28);
            --fs-base: oklch(0.965 0.008 118);
            --fs-white: oklch(0.998 0.001 118);
            --fs-surface: oklch(0.985 0.005 118);
            --fs-surface-raised: oklch(0.992 0.004 118);
            --fs-surface-strong: oklch(0.94 0.014 118);
            --fs-surface-muted: oklch(0.973 0.009 118);
            --fs-border: oklch(0.875 0.018 122);
            --fs-border-strong: oklch(0.76 0.03 132);
            --fs-text: oklch(0.29 0.028 155);
            --fs-text-muted: oklch(0.47 0.017 155);
            --fs-text-soft: oklch(0.64 0.012 155);
            --fs-rule: color-mix(in oklab, var(--fs-primary) 12%, transparent);

            --fs-accent: var(--fs-primary);
            --fs-accent-strong: var(--fs-primary-strong);
            --fs-accent-soft: color-mix(in oklab, var(--fs-secondary) 14%, var(--fs-surface));
            --fs-accent-line: color-mix(in oklab, var(--fs-primary) 20%, var(--fs-border));

            --fs-shadow-sm:
              0 1px 0 rgb(255 255 255 / 0.84),
              0 18px 34px -30px color-mix(in oklab, var(--fs-primary) 50%, transparent);
            --fs-shadow-md:
              0 1px 0 rgb(255 255 255 / 0.84),
              0 28px 46px -34px color-mix(in oklab, var(--fs-primary) 56%, transparent);
            --fs-shadow-lg:
              0 1px 0 rgb(255 255 255 / 0.86),
              0 42px 64px -42px color-mix(in oklab, var(--fs-primary) 62%, transparent);

            --space-xs: 4px;
            --space-sm: 8px;
            --space-md: 12px;
            --space-lg: 16px;
            --space-xl: 24px;
            --space-2xl: 32px;
            --space-3xl: 48px;
            --space-4xl: 64px;

            --focus-ring: 0 0 0 2px var(--fs-white), 0 0 0 5px color-mix(in oklab, var(--fs-secondary) 48%, var(--fs-primary));

            --font-body: "Public Sans", sans-serif;
            --font-heading: "Red Hat Display", sans-serif;
            --font-mono: "Azeret Mono", monospace;

            --text-xs: 0.75rem;
            --text-sm: 0.875rem;
            --text-body: 1rem;
            --text-lg: 1.1875rem;
            --text-xl: 1.625rem;
            --text-2xl: 2.125rem;
            --text-3xl: 2.875rem;

            --leading-tight: 1.04;
            --leading-snug: 1.25;
            --leading-body: 1.58;

            --weight-thin: 100;
            --weight-light: 300;
            --weight-regular: 400;
            --weight-medium: 500;
            --weight-semibold: 600;
            --weight-bold: 700;
            --weight-black: 800;

            --transition-fast: 140ms cubic-bezier(0.22, 1, 0.36, 1);
            --transition-base: 220ms cubic-bezier(0.22, 1, 0.36, 1);
          }

          *,
          *::before,
          *::after {
            box-sizing: border-box;
          }

          html,
          body {
            margin: 0;
            padding: 0;
            min-height: 100%;
            background: var(--fs-base);
          }

          body {
            position: relative;
            font-family: var(--font-body);
            color: var(--fs-text);
            text-rendering: optimizeLegibility;
            -webkit-font-smoothing: antialiased;
            font-size: var(--text-body);
            line-height: var(--leading-body);
            font-kerning: normal;
            padding-left: env(safe-area-inset-left);
            padding-right: env(safe-area-inset-right);
            padding-bottom: env(safe-area-inset-bottom);
            background:
              radial-gradient(circle at 10% 8%, color-mix(in oklab, var(--fs-secondary) 18%, transparent), transparent 24%),
              radial-gradient(circle at 88% 10%, color-mix(in oklab, var(--fs-primary) 12%, transparent), transparent 28%),
              linear-gradient(180deg, color-mix(in oklab, var(--fs-secondary) 6%, var(--fs-white)) 0%, transparent 24%),
              linear-gradient(180deg, oklch(0.978 0.006 116) 0%, var(--fs-base) 38%, oklch(0.955 0.01 120) 100%);
          }

          body::before {
            content: "";
            position: fixed;
            inset: 0;
            pointer-events: none;
            opacity: 0.48;
            background:
              linear-gradient(180deg, rgb(255 255 255 / 0.36), transparent 14%, transparent 84%, rgb(255 255 255 / 0.16)),
              repeating-linear-gradient(0deg, color-mix(in oklab, var(--fs-primary) 6%, transparent) 0 1px, transparent 1px 34px),
              repeating-linear-gradient(90deg, rgb(255 255 255 / 0.1) 0 1px, transparent 1px 54px);
            mix-blend-mode: multiply;
          }

          body::after {
            content: "";
            position: fixed;
            inset: 0;
            pointer-events: none;
            background:
              radial-gradient(circle at 18% 0%, rgb(255 255 255 / 0.45), transparent 18%),
              radial-gradient(circle at 82% 0%, rgb(255 255 255 / 0.22), transparent 24%);
            opacity: 0.6;
          }

          a {
            color: inherit;
            text-decoration-thickness: 1px;
            text-underline-offset: 0.18em;
            transition: color var(--transition-fast);
          }

          a:hover {
            color: var(--fs-primary);
          }

          button,
          input,
          select,
          textarea {
            font: inherit;
          }

          button:focus,
          input:focus,
          select:focus,
          textarea:focus,
          a:focus {
            outline: none;
          }

          button:focus-visible,
          input:focus-visible,
          select:focus-visible,
          textarea:focus-visible,
          a:focus-visible {
            box-shadow: var(--focus-ring);
          }

          button {
            transition: transform var(--transition-fast), box-shadow var(--transition-fast), background var(--transition-fast), border-color var(--transition-fast), color var(--transition-fast);
          }

          button:not(:disabled):hover {
            transform: translateY(-1px);
          }

          button:not(:disabled):active {
            transform: translateY(0);
          }

          #app-title,
          h1,
          h2,
          h3,
          h4 {
            font-family: var(--font-heading);
            font-kerning: normal;
            font-feature-settings: "ss01" 1;
          }

          ::selection {
            background: color-mix(in oklab, var(--fs-secondary) 28%, var(--fs-white));
          }

          s-button::part(control) {
            min-height: 46px;
            border-radius: 999px;
            letter-spacing: 0.012em;
            border: 1px solid color-mix(in oklab, var(--fs-primary) 88%, black);
            background:
              linear-gradient(180deg, rgb(255 255 255 / 0.22), rgb(255 255 255 / 0) 46%),
              linear-gradient(180deg, var(--fs-primary), var(--fs-primary-strong));
            box-shadow:
              inset 0 1px 0 rgb(255 255 255 / 0.16),
              0 18px 32px -24px color-mix(in oklab, var(--fs-primary) 62%, transparent);
          }

          s-button::part(label) {
            font-family: var(--font-body);
            font-weight: 700;
          }

          s-button[variant="secondary"]::part(control) {
            border-color: var(--fs-border-strong);
            background:
              linear-gradient(180deg, rgb(255 255 255 / 0.84), rgb(255 255 255 / 0.28) 20%, transparent 46%),
              var(--fs-surface-raised);
            box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.72), var(--fs-shadow-sm);
          }

          s-button[variant="secondary"]::part(label) {
            color: var(--fs-text);
          }

          @keyframes fs-shell-enter {
            0% {
              opacity: 0;
              transform: translateY(12px);
            }
            100% {
              opacity: 1;
              transform: translateY(0);
            }
          }

          [data-fs-shell] {
            animation: fs-shell-enter 420ms cubic-bezier(0.22, 1, 0.36, 1);
          }

          @media (prefers-reduced-motion: reduce) {
            *,
            *::before,
            *::after {
              animation: none !important;
              transition: none !important;
              scroll-behavior: auto !important;
            }

            [data-fs-shell] {
              animation: none !important;
            }
          }
        `}</style>
        <Meta />
        <Links />
      </head>
      <body>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
