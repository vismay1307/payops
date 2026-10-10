# ADR-002: Trust ladder and hard invariants

- **Status:** Accepted (Day 1, Oct 7, 2026)

## Context

PayOps combines AI with money-related actions. An LLM must never be able to move money, and every sensitive action must be explainable after the fact.

## Decision

Every case climbs five separate rungs. They are never blurred in code or UI:

1. **AI recommends:** the LLM returns a schema-validated proposal and never executes anything.
2. **Policy authorizes:** a deterministic engine (hard invariants + versioned JSON rules) returns ALLOW_AUTO, REQUIRE_APPROVAL or DENY with a trace.
3. **Human approves:** only when policy requires it, against an immutable snapshot of what the approver saw.
4. **PayPal executes:** only the action executor, with an idempotency key, may call PayPal write APIs.
5. **Outcome verified:** a signed PayPal webhook confirms the result; only then does the case close.

## Hard invariants (cannot be disabled by configuration)

| ID   | Invariant                                                               |
| ---- | ----------------------------------------------------------------------- |
| I-01 | Never automatically refund                                              |
| I-02 | Never automatically accept a dispute claim                              |
| I-03 | Never automatically submit dispute evidence (human approval always)     |
| I-04 | Sandbox only: refuse any PayPal base URL that is not the sandbox host   |
| I-05 | Global cap on automatic money-related actions                           |
| I-06 | Organisation kill switch                                                |
| I-07 | Decisions must be made on fresh context (case version and context hash) |
| I-08 | Action allowlist per case type                                          |
| I-09 | Low-confidence or invalid AI output escalates to a human                |
| I-10 | Attempt budget per case                                                 |

## Consequences

- AI quality problems degrade into human review, never into wrong payments.
- Write access to PayPal is confined to one module, enforced by a lint rule.
- Every decision stores its context hash, policy version and trace for auditability.
