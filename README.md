# BRF-protokoll

Dagordningar, protokoll och justering för bostadsrättsföreningars
styrelser. TanStack Start (React) with libSQL/SQLite, Tailwind and Biome.

## Development

pnpm is run through corepack (the version is pinned in `package.json`):

```bash
corepack pnpm install
corepack pnpm dev      # http://localhost:3000, database in local.db
corepack pnpm test     # vitest
corepack pnpm check    # biome: lint and format
```

No settings are needed in development. Emails are not sent: they land in
the outbox at <http://localhost:3000/utkorg>, where the links in them can be
followed. To try real delivery, set `RESEND_API_KEY`, `MAIL_FROM` and
`DEV_MAIL_TO`; every email then goes to `DEV_MAIL_TO`.

Database changes are numbered SQL files in `src/server/migrations/`. They
run automatically, in order, the first time the server uses the database;
each one either applies completely or not at all.

## Production build

```bash
corepack pnpm build
NODE_ENV=production APP_URL=https://… DATABASE_URL=file:prod.db \
  node .output/server/index.mjs
```

The build in `.output/` bundles everything except libSQL, which has a native
part and is loaded from `node_modules` at runtime.

## Settings

Environment variables, all described in [`.env.example`](.env.example). In
production the database, `APP_URL`, `RESEND_API_KEY` and `MAIL_FROM` are
required. `/api/health` answers
`200 {"ok":true}` when the settings are in place and the database answers,
and `503` with the problems otherwise; use it as the host's health check.

## Deploying to Bunny Magic Containers

Magic Containers runs Docker images built for **linux/amd64** from a
registry (Docker Hub, GitHub Container Registry, …).

1. Build and push the image:

   ```bash
   docker build --platform linux/amd64 -t ghcr.io/<owner>/brf-protokoll:latest .
   docker push ghcr.io/<owner>/brf-protokoll:latest
   ```

2. Create a Bunny Database, and under its Access page generate tokens and
   add them as secrets to the Magic Container app. That sets
   `BUNNY_DATABASE_URL` and `BUNNY_DATABASE_AUTH_TOKEN`.
3. Create the app from the image, with container port 3000, `APP_URL` set to
   the site's https address, `RESEND_API_KEY` and `MAIL_FROM`, and
   `/api/health` as health check.

Email goes through [Resend](https://resend.com). Verify the sending domain
there first (preferably a subdomain such as `mail.example.se`): Resend shows
the DNS records (SPF and DKIM) to add. Until a domain is verified, Resend
only delivers to the Resend account's own address.
4. The database is migrated when the first instance starts. Several
   instances starting at once take turns.

Still to check on the first deploy: which header carries the visitor's IP
address (for `TRUST_PROXY`), backups of the database, and response times
with the app and the database in different regions.
