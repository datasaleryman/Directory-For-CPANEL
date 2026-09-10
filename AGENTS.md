# Base44 dev notes

- Single process: `tsx server.ts` runs Express (API under `/api/*`) and mounts Vite in middleware mode for the React client. Everything is on port 3000 — no separate frontend/backend services.
- Run: `docker compose -f docker-compose.base44.yml up -d`. Deps install into a named `node_modules` volume on container start (first boot ~40s). After changing `package.json`, restart the `app` service.
- Health: `curl localhost:3000/api/health` → `{"status":"healthy"}`.
- Data store is file-backed JSON in `data/` (committed to the repo). `initDb()` seeds a master admin `admin` / `2026` if absent.
- Google Sheets sync is optional; credentials come from `data/sheets_config.json` (saved via Settings page) or env vars (`GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `SPREADSHEET_ID`). Base44 SDK client in `server/db.ts` uses a hardcoded public appId.
- `GEMINI_API_KEY` / `FIREBASE_API_KEY` in `.env.example` are unused by the code.
- Frontend edits hot-reload through Vite; server (`server.ts`, `server/*`) edits need `docker compose -f docker-compose.base44.yml restart app`.
- Lint/typecheck: `npm run lint` (tsc --noEmit).
