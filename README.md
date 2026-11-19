# Mötis

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
required, and a storage zone for uploaded files. `/api/health` answers
`200 {"ok":true}` when the settings are in place and the database answers,
and `503` with the problems otherwise. `/api/live` answers `200` whenever
the server is running, and checks nothing else.

## Deploying to Bunny Magic Containers

Magic Containers runs Docker images built for **linux/amd64** from a
registry (Docker Hub, GitHub Container Registry, …).

1. Push to `main`. The GitHub Action in `.github/workflows/image.yml` checks
   and tests the code, then builds the image and publishes it as
   `ghcr.io/martinfjant/motis:latest` (and tagged with the commit). New
   packages on GitHub are private: either make the package public, or give
   Bunny a GitHub token with `read:packages` under Image Registries.

   To build by hand instead:

   ```bash
   docker build --platform linux/amd64 -t ghcr.io/martinfjant/motis:latest .
   docker push ghcr.io/martinfjant/motis:latest
   ```

2. Create a Bunny Database, and under its Access page generate tokens and
   add them as secrets to the Magic Container app. That sets
   `BUNNY_DATABASE_URL` and `BUNNY_DATABASE_AUTH_TOKEN`.
3. Create the app from the image, with container port 3000, `APP_URL` set to
   the site's https address, `RESEND_API_KEY`, `MAIL_FROM`, `SIGNUP_PASSWORD`
   (without it no one can create an account), and the `motis-files` storage
   zone linked to the app (that sets `STORAGE_ZONE`, `STORAGE_ACCESS_KEY` and
   `STORAGE_HOSTNAME`). Health checks (Container Settings > Monitoring), all
   on port 3000:
   - Startup: TCP. The server is listening.
   - Readiness: HTTP GET `/api/health`. Settings, database and migrations
     are in order, so requests can be served.
   - Liveness: HTTP GET `/api/live`. Not `/api/health`: a restart can't fix
     the database, so a database problem mustn't restart the app.
4. The database is migrated when the first instance starts. Several
   instances starting at once take turns.

Email goes through [Resend](https://resend.com). Verify the sending domain
there first (preferably a subdomain such as `mail.example.se`): Resend shows
the DNS records (SPF and DKIM) to add. Until a domain is verified, Resend
only delivers to the Resend account's own address.

Still to check on the first deploy: backups of the database, and response
times with the app and the database in different regions. For limiting
login attempts per IP address, set up the Bunny edge rule and
`CLIENT_IP_HEADER` described in `.env.example`.
