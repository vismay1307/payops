# AGENTS.md: Rules for AI Coding Assistants Working on PayOps

PayOps is an AI revenue-recovery agent for PayPal businesses.
This is a hackathon project and must remain sandbox-only.

Read `docs/adr/` before changing architecture.

## Core Principle

AI proposes. Policy decides. Humans approve. PayPal confirms.

- LLM output must never be executed directly.
- An LLM must never call PayPal directly.
- Never automatically issue refunds.
- Never automatically accept a dispute claim.
- Never automatically submit dispute evidence. Human approval is mandatory.

## Commands

- Install dependencies: `pnpm install`
- Start the development API: `pnpm dev`
- Start local PostgreSQL: `pnpm db:up`
- Run the quality gate: `pnpm verify`
- Run API tests: `pnpm --filter @payops/api test`

## Architecture

Follow this layering:

Routes → Controllers → Services → Repositories → Database

- Routes and controllers validate input and call services.
- Routes and controllers must not import repositories, database modules, integrations, or actions directly.
- Only `apps/api/src/db` may import `pg` or the ORM.
- Only `apps/api/src/integrations/paypal` handles PayPal URLs and response shapes.
- Only `apps/api/src/actions` may execute PayPal write operations.
- Only the orchestrator may invoke AI roles.
- AI roles must not have tools that perform write operations.

## Security and Safety Invariants

- `PAYPAL_ENV` must always be `sandbox`.
- Every action requires an idempotency key.
- Every state change must write an audit row in the same transaction.
- Do not modify `policies/invariants.ts` or `actions/executor.ts` without an explicit human request.
- Never log secrets, access tokens, or complete PayPal payloads.
- Never commit `.env` files.
- Validate all external inputs with Zod, including request bodies, PayPal payloads, environment variables, and LLM output.

## TypeScript and Code Conventions

- Use strict TypeScript.
- Avoid `any` unless there is a documented reason.
- Do not use `console.log`; use the project's Pino logger.
- Represent money using integer minor units and a currency.
- Parse PayPal decimal strings carefully; do not use floating-point arithmetic for money.
- Throw `AppError(code, status, message)` for application errors.
- Use the project's standard error response shape:
  `{ error: { code, message, requestId } }`.
- Register webhook routes before `express.json()` because signature verification requires the raw body.
- Use small, focused commits with Conventional Commit messages.

## Testing and Verification

- Write tests for high-risk behavior first: idempotency, policy decisions, state transitions, and webhook verification.
- Prefer saved PayPal payload fixtures from `apps/api/tests/fixtures/paypal/`.
- Run `pnpm verify` before every commit.
- A change is complete only when the quality gate passes.

## PayPal Integration Rules — Day 3

- Invariant I-04 is mandatory: PayOps may communicate only with `https://api-m.sandbox.paypal.com`.
- Never introduce a production PayPal base URL or a configurable production override.
- Import the read-only PayPal facade from `integrations/paypal/read.ts` wherever reads are needed.
- Keep write operations behind `integrations/paypal/write.ts`; follow the existing ESLint restriction and do not import the write facade into routes or controllers.
- Spike scripts and tests may use the write facade explicitly.
- Never log credentials, access tokens, authorization headers, complete raw PayPal responses, or recipient email addresses.
- Redact sensitive fields and emails before saving API responses as fixtures.
- Never blindly retry a non-idempotent invoice-creation request after an ambiguous network failure.
- Keep invoice tests offline with mocked HTTP. Unit tests must not create, send, cancel, or remind real invoices.
- The manual sandbox spike is an explicit side-effecting operation. Run it only after code verification and human confirmation.
- Test authentication refresh, single-flight token requests, retry behavior, money parsing, and invoice create/send/read/remind behavior.
