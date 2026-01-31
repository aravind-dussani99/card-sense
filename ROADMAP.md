# Roadmap

This roadmap captures the next set of planned capabilities so we can prioritize and ship in clear phases.

## Phase 1.1 — Stabilize and Release (near-term)
- [x] Finalize local Postgres workflow and remove SQLite drift
  - Single Prisma provider (`postgresql`) across local + prod
  - Postgres migration history (separate from old SQLite history)
- [ ] CI/CD hardening
  - Ensure image selection by digest works reliably
  - Add lightweight smoke checks post-deploy (health endpoint)
  - Document rollback steps
- [ ] Transaction UX polish
  - Compact sync/filter dialogs (single-row layout)
  - Table density controls (comfortable/compact)
  - Safer empty states and clearer sync guidance

## Phase 1.2 — Multi-user + Access Control
- [ ] Authentication flows
  - Email/password sign-up and login
  - Forgot password with OTP/email verification
  - Session management and basic account settings
- [ ] User scoping in data model
  - Add `userId` to key tables
  - Enforce per-user data access in backend routes

## Phase 1.3 — Core Finance Depth
- [ ] Accounts Hub improvements
  - Clear separation of bank accounts, overdrafts, and credit cards
  - Better limit/used/available breakdowns everywhere
  - Link KPI clicks to filtered sections consistently
- [ ] Transaction metadata system
  - Keep raw Open Banking transaction immutable
  - Store overrides/annotations in a linked meta table
  - Strong audit fields: created/updated/by
- [ ] Attachments
  - Upload receipts/proofs and link to transactions
  - Storage abstraction (local now, cloud later)

## Phase 2 — Intelligence Without AI-first Dependence
- [ ] Category automation (rule-based)
  - Auto-learn keyword/category mappings from user edits
  - Conflict resolution and “suggested mappings” review
- [ ] Reconciliation workflows
  - Better review queues and approvals
  - De-duplication and merge flows

## Phase 3 — Rewards and Offers
- [ ] Rewards page (first usable version)
  - Rewards balances by card/program
  - Rewards transaction history
  - Redemption tracking (manual first)
- [ ] Offers foundation
  - Card-linked offers model
  - Eligibility + tracking

## Phase 4 — Mobile Maturity
- [ ] Mobile app parity (Expo)
  - Cards, accounts, transactions, settings
  - Dialog flows that mirror web where sensible
- [ ] Mobile-specific UX
  - Safer modals, better table alternatives
  - Performance and offline-safe patterns

## Later / Optional Tracks
- [ ] Near-real-time alerts
  - Evaluate practical paths for “right-after transaction” alerts
  - Likely requires polling + thresholds or bank-native notifications
- [ ] Statement extraction and email ingestion
  - Revisit legacy features intentionally
  - Add tests and clear boundaries
- [ ] LLM features (opt-in)
  - Assistant-style insights and categorization review
  - Never block core flows on LLM availability

## Priority guidance (default order)
1) Stabilize Postgres + CI/CD
2) Auth + user scoping
3) Transaction correctness and metadata depth
4) Rewards/offers and mobile parity
