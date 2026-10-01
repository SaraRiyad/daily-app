# Daily

Daily is an Android-focused personal life, work, and money companion, with a matching interactive design prototype.

## Run & Operate

- Start the API with the managed `artifacts/api-server: API Server` workflow; its port is assigned by the artifact.
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/daily-mobile run typecheck` — check the native app
- `pnpm --filter @workspace/daily-mobile test` — local sync/outbox regression tests
- `pnpm --filter @workspace/api-server test` — account/validation unit tests
- `pnpm --filter @workspace/api-server run test:integration` — development PostgreSQL integration tests with isolated, cleaned-up fixtures
- `pnpm --filter @workspace/api-server run test:api` — HTTP contract tests through the running managed API proxy
- Start native preview with the managed `artifacts/daily-mobile: expo` workflow.
- Daily requires the API server and PostgreSQL for accounts and saved workspaces. Apply schema changes to development with the DB push command; do not run schema creation at server startup.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/daily-mobile/` — native Expo app; app routes, shared state and calculations in `state/`, native UI in `screens/` and `components/daily/`.
- `artifacts/mockup-sandbox/src/components/mockups/daily/` — original canvas prototype, preserved separately.
- `artifacts/daily-mobile/constants/colors.ts` — native colors and Outfit font names matched to the prototype.
- `lib/daily-model/` — shared workspace validation and earnings calculations.
- `lib/db/src/schema/` — account, session, workspace, idempotency and rate-limit tables.

## Architecture decisions

- The database upgrade replaces prototype-only accounts with real email/password accounts. Never reuse demo credentials. Passwords are submitted over HTTPS, hashed on the server, and never stored on the device or logged.
- Each account owns a versioned database workspace covering jobs, active/completed shifts, tasks, transactions, calendar, profile and preferences. Revision conflicts must never silently overwrite another device's changes.
- Keep the legacy device workspace untouched. Import requires explicit consent after authentication and must not replace populated cloud data. New accounts start empty, not with demo records.
- No email verification or password-reset delivery service is connected. Do not label email addresses as verified or offer a nonfunctional reset flow.
- Estimated work earnings and received income are different: clocking out must not create an income transaction.
- The original canvas/browser prototype remains independent of the database-backed mobile app.

## Product

Tasks, multiple jobs, shift timers and overtime estimates, work history, per-job calendar statuses, income/expense tracking in shekels, job export and guarded deletion, real accounts and database-backed workspaces.

## User preferences

Keep Daily in the same visual family as the Courier reference: coral, charcoal, Outfit typography, rounded controls and warm light cards. Mobile-first, not an enterprise or desktop dashboard.

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
