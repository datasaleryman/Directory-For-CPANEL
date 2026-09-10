# Base44 dev notes

- Single process: `tsx server.ts` runs Express (API under `/api/*`) and mounts Vite in middleware mode for the React client. Everything is on port 3000 — no separate frontend/backend services.
- Run: `docker compose -f docker-compose.base44.yml up -d`. Deps install into a named `node_modules` volume on container start (first boot ~40s). After changing `package.json`, restart the `app` service.
- Health: `curl localhost:3000/api/health` → `{"status":"healthy"}`.
- Data store is file-backed JSON in `data/` (committed to the repo). `initDb()` seeds a master admin `admin` / `2026` if absent.
- cPanel MySQL database sync is supported with automated fallback to file-backed JSON in `data/`. cPanel MySQL credentials can be configured via `data/cpanel_config.json` (saved via Settings > cPanel Database) or environment variables (`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`).
- Deployment on cPanel is fully supported via `app.js` and Phusion Passenger / "Setup Node.js App".
- Frontend edits hot-reload through Vite; server (`server.ts`, `server/*`) edits need `docker compose -f docker-compose.base44.yml restart app`.
- Lint/typecheck: `npm run lint` (tsc --noEmit).
