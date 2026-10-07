# Day 1: PayPal sandbox verification

Date: 2026-10-07

> Never paste secrets, full tokens, or full client ids here.

| Check | Result | Notes |
|-------|--------|-------|
| OAuth token (client credentials) | ✅ PASS | expires_in = 32400s |
| Invoicing API reachable (`GET /v2/invoicing/invoices`) | ✅ PASS | total invoices = 0, debug id = f4472649bdf86 |
| Scope hints in token response | ✅ PASS | invoicing / disputes / subscriptions / reporting |

## Notes

- PayPal Sandbox OAuth authentication succeeded.
- The Default Application returned an access token successfully.
- Invoicing API returned successfully with 0 invoices.
- Token scope included invoicing, disputes, subscriptions and reporting.
- No secrets or full tokens were recorded.