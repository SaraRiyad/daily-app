# Daily

Daily is an Android-focused personal life, work, and money companion, with a matching interactive design prototype.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/daily-mobile run typecheck` — check the native app
- Start native preview with the managed `artifacts/daily-mobile: expo` workflow.
- The Daily app is local-only; it does not require a database or API.

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

## Architecture decisions

- The user explicitly chose prototype-only accounts. Password fields demonstrate validation and visibility toggles, not authentication. Never persist or transmit their values.
- Estimated work earnings and received income are different: clocking out must not create an income transaction.
- Native device storage and the original browser prototype are independent; do not imply automatic migration or cross-device sync.

## Product

Tasks, multiple jobs, shift timers and overtime estimates, work history, per-job calendar statuses, income/expense tracking, job export and guarded deletion, and demo onboarding.

## User preferences

Keep Daily in the same visual family as the Courier reference: coral, charcoal, Outfit typography, rounded controls and warm light cards. Mobile-first, not an enterprise or desktop dashboard.

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
