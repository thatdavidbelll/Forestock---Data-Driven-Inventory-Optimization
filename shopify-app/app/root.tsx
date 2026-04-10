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
            --fs-indigo: #2f6fed;
            --fs-violet: #6b7cff;
            --fs-sky: #78a6ff;
            --fs-base: #f5f7fa;
            --fs-white: #ffffff;
            --fs-surface: #ffffff;
            --fs-surface-strong: #ffffff;
            --fs-surface-muted: #f8fafc;
            --fs-border: #d9dee7;
            --fs-text: #1f2937;
            --fs-text-muted: #5b6472;
            --fs-success: #2f7d5c;
            --fs-warning: #a06800;
            --fs-critical: #bf3f45;
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
