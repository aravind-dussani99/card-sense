# Card Sense

Card Sense is now organized as a 3-tier app:
- `frontend/`: Next.js 16 App Router UI
- `backend/`: Express + Prisma API
- `backend/prisma`: database schema + migrations (SQLite for local dev)

## Quick start
- Prereqs: Node 20+, npm.
- Backend:
  - `cd backend`
  - `npm install`
  - Env: copy `backend/.env.example` to `.env` (or run from repo root with the existing `.env`)
  - DB seed: `npm run seed`
- Start API: `npm run dev` (serves http://localhost:8081)
- Frontend:
  - `cd frontend`
  - `npm install`
  - Env: copy `frontend/.env.example` to `.env.local`
  - Start UI: `npm run dev` then open http://localhost:3000

## Environment
Set in `backend/.env`:
- `DATABASE_URL=file:./dev.db`
- Outlook IMAP: `OUTLOOK_USER`, `OUTLOOK_PASSWORD` (app password), optional `OUTLOOK_HOST`/`OUTLOOK_PORT` (defaults `outlook.office365.com:993`)
- Gmail OAuth: `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, `GMAIL_REDIRECT_URI`
- TrueLayer (Open Banking): `TRUELAYER_CLIENT_ID`, `TRUELAYER_CLIENT_SECRET`, `TRUELAYER_REDIRECT_URI`

## Secure Vault (local-only)
- A local-only encrypted vault is available at `/vault`.
- Data is encrypted in the browser and stored only on the device (no server sync).

## Encrypted credentials (server-side storage)
- Bank account and card credentials are stored as encrypted payloads in the database.
- Run Prisma migrations after schema updates: `cd backend && npx prisma migrate dev`.
- LLM: `OPENAI_API_KEY`, optional `OPENAI_MODEL`; `ANTHROPIC_API_KEY`/`ANTHROPIC_MODEL`; `USE_LLM_FOR_STATEMENTS=true|false`
- Optional SMTP if you send mail: `SMTP_HOST`, `SMTP_PORT`

Reference docs in repo: `QUICK_SETUP.md`, `EMAIL_SETUP.md`, `EMAIL_LLM_SETUP.md`, `EMAIL_CONFIGURATION.md`, `OUTLOOK_SETUP_FIX.md`, `GOOGLE_OAUTH_SETUP.md`, `GMAIL_TOKEN_SETUP.md`.

## Email providers
- Outlook: requires 2FA + IMAP enabled + app password. Test with `node scripts/test-outlook-connection.js` (auto-loads `.env`). If you see `LOGIN failed`, regenerate an app password and confirm IMAP is enabled on the account. You can override the host with `OUTLOOK_HOST=imap-mail.outlook.com` if your tenant requires it.
- Gmail: follow `GOOGLE_OAUTH_SETUP.md`/`GMAIL_TOKEN_SETUP.md` to create OAuth credentials and refresh token; `GMAIL_REDIRECT_URI` should match the OAuth app.

## LLM + statements
- Email parsing uses OpenAI by default; Anthropic is supported.
- Statement parsing can use LLM when `USE_LLM_FOR_STATEMENTS` is not `false`; otherwise regex fallback is used.

## Database + tools
- Manage data with `npx prisma studio`.  
- Seed sample data: `npm run seed` in `backend/`.
- SQLite file lives at `dev.db`.

## Checks and troubleshooting
- Lint: `npm run lint` (currently fails with many `no-explicit-any`/unused warnings and a few React hook warnings; prioritize typing the server actions/components).  
- Build: `npm run build` currently fails offline because Next tries to fetch Geist fonts from Google; allow network or pin local fonts to unblock CI.  
- Outlook auth: use the test script above; errors about authentication almost always mean missing 2FA/app password or IMAP disabled.

## Smoke testing email/LLM flows
- Outlook IMAP: `node scripts/test-outlook-connection.js` to verify credentials reach inbox and fetch an unread message.  
- Gmail OAuth: `node scripts/verify-gmail-credentials.js` or `node scripts/generate-gmail-token.js` to validate your OAuth keys/refresh token.  
- Statements: upload a sample PDF/CSV via the app; set `USE_LLM_FOR_STATEMENTS=false` if you want to test the regex path without API calls.
