# Card Sense

[![CI + Build + Deploy](https://github.com/aravind-dussani99/card-sense/actions/workflows/cloud-run-deploy.yml/badge.svg)](https://github.com/aravind-dussani99/card-sense/actions/workflows/cloud-run-deploy.yml)

Card Sense is a 3-tier personal finance app focused on cards, bank accounts, Open Banking sync, and transaction review.

## Architecture
- `frontend/`: Next.js 16 App Router UI
- `backend/`: Express + Prisma API
- `backend/prisma/`: Prisma schema and migrations
- `mobile-app/`: Expo (work-in-progress)

## Phase-1 features
- Accounts Hub with separate sections for bank accounts, overdrafts, and credit cards
- Dashboard KPIs wired to live balances and quick navigation
- Open Banking sync into a central transaction store
- Transaction workbench with:
  - Sync + Filter dialogs
  - Sticky headers, pagination, and per-row actions
  - Metadata layer (opening/closing balances, from/to, head account, notes)
- Secure Vault (local-only, client-side encryption) for sensitive details
- Settings and reference data management (banks, categories, card types)

## Local development (Postgres via Docker) — recommended
This keeps local behavior aligned with production.

1) Start Postgres in Docker (use port 5433 to avoid conflicts):

```bash
docker rm -f card-sense-postgres 2>/dev/null || true
docker run --name card-sense-postgres \
  -e POSTGRES_USER=card_sense_user \
  -e POSTGRES_PASSWORD=card_sense_pass \
  -e POSTGRES_DB=card_sense_dev \
  -p 5433:5432 \
  -d postgres:16
```

2) Backend environment:
- Copy `backend/.env.example` to `backend/.env`
- Set:

```bash
DATABASE_URL="postgresql://card_sense_user:card_sense_pass@localhost:5433/card_sense_dev?schema=public"
PORT=8081
```

3) Use the Postgres Prisma schema locally:
- In `backend/prisma/schema.prisma`, set:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

4) Reset migrations (required when switching from SQLite to Postgres):

```bash
rm -rf backend/prisma/migrations
cd backend
npx prisma migrate dev --name init
npx prisma generate
npm run seed
npm run dev
```

5) Frontend:

```bash
cd frontend
npm install
npm run dev
```

Open:
- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8081`

## Usage notes
- Open Banking:
  - Configure TrueLayer env vars in `backend/.env`
  - Authorize via Settings
  - Use the Sync button on the Transactions page header
- Transactions:
  - Use Sync/Filter from the page header
  - Edit/annotate via row actions
  - Deletion is limited to cash/manual entries
- Vault:
  - Vault and passphrase are device-local by design

## Deployment
- CI/CD runs via GitHub Actions: `.github/workflows/cloud-run-deploy.yml`
- Production deploys occur on `main` pushes
- PRs are lint/format focused (deploy steps disabled)
- Frontend builds use Node 20 in Docker to match Next.js 16 requirements

## Contribution guide
1) Create a feature branch:

```bash
git checkout -b feature/your-change
```

2) Run checks locally:

```bash
cd backend && npm install && npm run lint --if-present
cd frontend && npm install && npm run lint --if-present
```

3) Validate the app:
- Run backend on `8081`
- Run frontend on `3000`
- Exercise Accounts Hub and Transactions flows

4) Commit and open a PR:

```bash
git add .
git commit -m "feat: describe your change"
git push origin feature/your-change
```

## Troubleshooting
- Frontend Docker build fails with Node 18:
  - Next.js 16 requires Node `>=20.9`
  - This repo now uses Node 20 in `frontend/Dockerfile`
- Port conflicts on local Postgres:
  - Use `5433:5432` and update `DATABASE_URL`
