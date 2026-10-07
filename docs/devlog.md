# PayOps devlog

Format per day: Plan, Why, Done, Surprised me, Tomorrow starts with.

## Day 1: Wed Oct 7, 2026

**Plan:** public repo, licence, docs skeleton, safe env setup, one verified PayPal sandbox call.

**Why:** a stable, safe base before any feature work; secrets hygiene from the first commit.

**Done:** Created the public PayOps repository, added the MIT licence, repository configuration, architecture ADRs, devlog, sandbox documentation, safe environment setup, and successfully authenticated against PayPal Sandbox and called the Invoicing API.

**Surprised me:** The PayPal Sandbox token included scope hints for invoicing, disputes, subscriptions, and reporting, while the Invoicing API currently returned zero invoices.

**Tomorrow starts with:** Day 2, pnpm monorepo + API skeleton + CI + first deploy.