# Forestock Shopify App

This directory contains the standalone Shopify app scaffold for Forestock. It was generated with Shopify CLI using the React Router template and then trimmed to remove duplicate scaffolding and generic template leftovers.

## Purpose

This app is intended to be the Shopify-facing surface for Forestock integrations. The current scaffold provides:

- Shopify app authentication and embedded app wiring
- Prisma-backed session storage
- App webhook route stubs created by the template
- A starting point for Forestock-specific Shopify features

## Local Development

Prerequisites:

- Node.js 20+
- Shopify CLI
- A Shopify app configured in the Partner Dashboard

Install dependencies:

```bash
cd shopify-app
npm ci
```

Start local development:

```bash
npm run dev
```

## Important Config Files

- `shopify.app.toml` defines the app name, URLs, scopes, and webhook subscriptions
- `shopify.web.toml` defines web app settings used by Shopify CLI
- `prisma/schema.prisma` defines the session storage schema
- `app/shopify.server.ts` contains the core Shopify app server configuration

## Notes

- The scaffold is still close to Shopify's default template and should be adapted to Forestock's real scopes, webhook subscriptions, and UI flows.
- The generated `shopify.app.toml` still contains placeholder URLs and template metadata that should be updated before deployment.
