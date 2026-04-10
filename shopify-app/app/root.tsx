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
            --fs-violet: #6D28D9;
            --fs-sky: #E0E7FF;
            --fs-base: #F4F5F7;
            --fs-white: #ffffff;
            --fs-surface: #ffffff;
            --fs-surface-strong: #FCFCFD;
            --fs-surface-muted: #F8FAFC;
            --fs-border: #E5E7EB;
            --fs-text: #111827;
            --fs-text-muted: #6B7280;
            --fs-success: #1F7A5C;
            --fs-warning: #A16207;
            --fs-critical: #B42318;
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
            -webkit-font-smoothing: antialiased;
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
