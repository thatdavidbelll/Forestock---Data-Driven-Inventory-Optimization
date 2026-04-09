import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";

export default function App() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <link rel="preconnect" href="https://cdn.shopify.com/" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;700&display=swap"
          rel="stylesheet"
        />
        <style>{`
          :root {
            --fs-indigo: #4F46E5;
            --fs-violet: #7C3AED;
            --fs-sky: #38BDF8;
            --fs-base: #0F172A;
            --fs-white: #F8FAFC;
            --fs-surface: rgba(15, 23, 42, 0.82);
            --fs-surface-strong: rgba(15, 23, 42, 0.94);
            --fs-surface-muted: rgba(30, 41, 59, 0.78);
            --fs-border: rgba(148, 163, 184, 0.16);
            --fs-text: #E2E8F0;
            --fs-text-muted: rgba(226, 232, 240, 0.72);
            --fs-success: #22D3EE;
            --fs-warning: #F59E0B;
            --fs-critical: #F87171;
          }

          * {
            box-sizing: border-box;
          }

          html, body {
            margin: 0;
            padding: 0;
            min-height: 100%;
            background: var(--fs-base);
          }

          body {
            font-family: "Manrope", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            color: var(--fs-text);
            text-rendering: optimizeLegibility;
          }

          a {
            color: inherit;
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
