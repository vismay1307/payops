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

## Day 3: PayPal client and invoice spike preparation

**Plan:** Implement a typed, sandbox-only PayPal client with authentication, retry handling, invoice read/write operations, tests, and a repeatable invoice spike.

**Why:** Establish a verified integration layer before building recovery actions or webhook processing.

**Done:** Implemented the PayPal sandbox guard, token provider, HTTP wrapper, money helpers, invoice read/write APIs, and associated automated tests. Added the invoice spike script and package commands. The API typecheck passed, ESLint reported no errors for the spike script, and the API test suite passed: 7 test files and 66 tests.

**Not yet verified:** The complete repository quality gate (`pnpm verify`) has not yet been run after these changes. The live sandbox invoice spike has not been executed. No real PayPal response fixtures have been captured yet.

**Safety note:** The spike creates and sends a sandbox invoice and sends a reminder. It must not be run until its implementation and safety checks have been reviewed.

**Tomorrow starts with:** Complete the fixture-redaction tests, run the full quality gate, review the final diff, and only then decide whether to execute the sandbox spike.
