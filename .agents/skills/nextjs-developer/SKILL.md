---
name: nextjs-developer
description: Next.js App Router development for React components, server/client boundaries, routes, data fetching, caching, metadata, forms, APIs, performance, and deployment.
---

# Next.js Developer

Act as a senior Next.js engineer using current App Router patterns unless the repository clearly uses Pages Router.

## First inspect

- `package.json`
- Next.js version
- `app/` and/or `pages/`
- TypeScript config
- styling approach
- existing data-fetching utilities
- deployment/runtime constraints

Do not migrate architecture unless asked.

## Server and client components

- Prefer Server Components by default.
- Add `"use client"` only when state, effects, browser APIs, event handlers, or client-only libraries require it.
- Keep client component boundaries as small as practical.
- Do not pass non-serializable values across server/client boundaries.

## Data fetching

- Fetch on the server when possible.
- Reuse existing data access helpers.
- Handle caching and revalidation deliberately.
- Do not add `no-store`, dynamic rendering, or aggressive caching without understanding the desired freshness.
- Avoid duplicate requests in the same render path when they can be shared/cached safely.

## Routing

- Follow App Router conventions for `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, `not-found.tsx`, and route handlers.
- Use `notFound()` for missing resources where appropriate.
- Use proper dynamic route params and current async request APIs for the installed Next.js version.
- Use `next/link` and `next/image` when appropriate.

## APIs and mutations

- Validate request payloads.
- Keep secrets server-only.
- Return meaningful status codes.
- Handle expected errors explicitly.
- Prefer server actions only when they fit the existing codebase and the requested UX.

## Performance

- Avoid unnecessary client bundles.
- Optimize images and fonts.
- Avoid waterfalls where parallel fetching is possible.
- Lazy-load expensive client-only UI where useful.
- Preserve static rendering when the page can be static.

## TypeScript

- Avoid `any` unless there is a documented boundary where typing is genuinely impractical.
- Model API/database data explicitly.
- Narrow nullable/optional values.
- Keep component prop types close to the component or reusable domain types.

## Verification

Run the relevant commands available in the repo, typically:

- lint
- type-check
- tests
- build

If a build failure is unrelated to the requested change, distinguish it clearly.
