#!/usr/bin/env node

// PayOps Day 1: prove we can authenticate to the PayPal SANDBOX
// and call a real API.
// Run:
// node --env-file=.env scripts/day1-sandbox-check.mjs

const SANDBOX = 'https://api-m.sandbox.paypal.com';

const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;

const ok = (m) => console.log(`${green('✓')} ${m}`);

const die = (m) => {
  console.error(`${red('✗')} ${m}`);
  process.exit(1);
};

const { PAYPAL_ENV = 'sandbox', PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET } = process.env;

// Invariant I-04 preview: sandbox only.
if (PAYPAL_ENV !== 'sandbox') {
  die(`PAYPAL_ENV must be "sandbox" (got "${PAYPAL_ENV}")`);
}

if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
  die('PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET are missing in .env');
}

ok(`Environment is sandbox (${SANDBOX})`);

async function call(path, init = {}) {
  const res = await fetch(`${SANDBOX}${path}`, {
    ...init,
    signal: AbortSignal.timeout(10_000),
  });

  const text = await res.text();

  let body;

  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }

  return {
    res,
    body,
    debugId: res.headers.get('paypal-debug-id'),
  };
}

// 1) OAuth 2.0 client-credentials grant
const basic = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');

const token = await call('/v1/oauth2/token', {
  method: 'POST',
  headers: {
    Authorization: `Basic ${basic}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  },
  body: 'grant_type=client_credentials',
});

if (!token.res.ok) {
  die(
    `Token request failed: HTTP ${token.res.status} ` +
      `${token.body.error ?? ''} ` +
      `${token.body.error_description ?? ''} ` +
      `(debug id: ${token.debugId})`,
  );
}

ok(
  `Access token received ` +
    `(expires in ${token.body.expires_in}s, app id: ${token.body.app_id ?? 'n/a'})`,
);

// Informational only: which API areas does this token's scope list mention?
const scope = String(token.body.scope ?? '');

for (const key of ['invoicing', 'disputes', 'subscriptions', 'reporting']) {
  const present = scope.includes(key);

  console.log(
    `  ${present ? green('•') : '·'} scope hint "${key}": ${present ? 'listed' : 'not listed'}`,
  );
}

// 2) A real API call: list invoices
// An empty list is still a successful API call.
const invoices = await call('/v2/invoicing/invoices?page=1&page_size=5&total_required=true', {
  headers: {
    Authorization: `Bearer ${token.body.access_token}`,
  },
});

if (!invoices.res.ok) {
  die(
    `Invoices list failed: HTTP ${invoices.res.status} ` +
      `${invoices.body.name ?? ''} ` +
      `${invoices.body.message ?? ''} ` +
      `(debug id: ${invoices.debugId})`,
  );
}

const total = invoices.body.total_items ?? invoices.body.items?.length ?? 0;

ok(`Invoicing API reachable: ${total} invoice(s) ` + `(debug id: ${invoices.debugId})`);

console.log(
  '\nDay 1 sandbox check passed. ' +
    'Copy the lines above (no secrets) into docs/spikes/day1-sandbox.md',
);
