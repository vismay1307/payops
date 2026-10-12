# PayOps devlog

Format per day: Plan, Why, Done, Surprised me, Tomorrow starts with.

## Day 1: Wed Oct 7, 2026

**Plan:** public repo, licence, docs skeleton, safe env setup, one verified PayPal sandbox call.

**Why:** a stable, safe base before any feature work; secrets hygiene from the first commit.

**Done:** Created the public PayOps repository, added the MIT licence, repository configuration, architecture ADRs, devlog, sandbox documentation, safe environment setup, and successfully authenticated against PayPal Sandbox and called the Invoicing API.

**Surprised me:** The PayPal Sandbox token included scope hints for invoicing, disputes, subscriptions, and reporting, while the Invoicing API currently returned zero invoices.

**Tomorrow starts with:** Day 2, pnpm monorepo + API skeleton + CI + first deploy.

## Day 2: Monorepo, CI, and first deployment

**Plan:** Establish the pnpm workspace, API foundation, automated CI, and first deployed API.

**Why:** Build a repeatable engineering foundation before implementing payment-recovery features.

**Done:** Set up the pnpm workspace for the API, web application, and shared package; configured quality-check scripts and GitHub Actions CI; deployed the API through the Render Blueprint; verified `/healthz` and `/readyz`, including database readiness; and added `AGENTS.md` with architecture, security, and testing rules.

**Surprised me:** A successful API health check is not the same as readiness. The readiness endpoint also checks database connectivity.

**Tomorrow starts with:** Review the API foundation and begin the first recovery-domain implementation with validation and tests.
