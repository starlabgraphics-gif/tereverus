# Tereverus TV — Netlify Deployment Guide

## Required environment variable

| Key             | Value                                                        |
| --------------- | ------------------------------------------------------------ |
| `DATABASE_URL`  | PostgreSQL connection string (Neon, Supabase, RDS, …)        |

Set it in **Site configuration → Environment variables** (not in the repo —
`.env` is git-ignored on purpose). The build does **not** need the variable;
it is only used at runtime, and the database tables are created
automatically on first request.

## Build plugins (App Router)

Both must be present in **Site configuration → Build plugins** (also
declared in `netlify.toml`):

- `@netlify/plugin-nextjs`
- `@netlify/plugin-edge-handlers`

The earlier "DATABASE_URL is required" build error is fixed: the database
is initialized lazily, so `next build` succeeds with the variable unset.

## Media storage

- On Netlify, uploaded videos and thumbnails are stored in **Netlify Blobs**
  (R2-backed) automatically and streamed via `/api/media/<file>`.
- Locally, media is written to `public/uploads/`.
- No extra setup or credentials needed for blobs.

## Admin access

- Control room login: click the channel logo **4 times** on the broadcast
  page (there is no visible admin link).
- Credentials are fixed in code: `njerukwetu@gmail.com` / `Kwetu@254`.

## Seed demo content (optional, local only)

```bash
npx drizzle-kit push
DATABASE_URL="..." node scripts/seed-media.mjs
```
