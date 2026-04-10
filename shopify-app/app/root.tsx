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
            --fs-base: #f6f8ff;
            --fs-white: #ffffff;
            --fs-surface: #ffffff;
            --fs-surface-strong: #fdfdff;
            --fs-surface-muted: #eef2ff;
            --fs-border: #d8ddf3;
            --fs-text: #0f172a;
            --fs-text-muted: #475569;
            --fs-success: #13795b;
            --fs-warning: #b45309;
            --fs-critical: #be123c;
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
