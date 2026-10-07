# ADR-001: Stack and repository layout

- **Status:** Accepted (Day 1, Oct 7, 2026)

## Context

PayOps is built by one developer with an AI coding assistant in 30 days. It must receive PayPal webhooks on a public HTTPS URL, be easy for hackathon judges to run, and keep AI strictly separated from money-moving actions.

## Decision

| Area | Choice |
|------|--------|
| Repository | pnpm workspaces monorepo: `apps/api`, `apps/web`, `packages/shared` |
| Runtime and language | Node 22 LTS, TypeScript (strict) |
| API | Express 5 |
| Database | PostgreSQL with Drizzle ORM and migrations |
| Validation | Zod, shared between API, web and AI output schemas |
| Background jobs | pg-boss (Postgres-based queue, no Redis) |
| Web | React + Vite single-page app; AG Grid / AG Studio for the operations console |
| AI | Provider-agnostic `LLMClient` interface, structured outputs, record/replay mode |
| Hosting | Render (web service, static site, managed Postgres, cron) |
| PayPal | Sandbox only: REST APIs and webhooks |
| Licence | MIT |

## Consequences

- One language end to end; Zod schemas are shared everywhere.
- No SSR: the console sits behind login, and AG Studio runs in the browser.
- Providers (LLM, email) can be swapped behind interfaces without touching business logic.
- A paid Render instance and database are needed so webhooks never hit a sleeping service.

## Alternatives rejected

- Next.js: no SSR benefit here and one more server to run.
- Prisma: heavier build, awkward with partial unique indexes.
- BullMQ: requires Redis.
- Hosted auth: extra setup for anyone running the repo.