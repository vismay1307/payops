#!/usr/bin/env bash
set -euo pipefail

echo "=== PayOps Day 1 Verification ==="
echo

fail() {
  echo "FAIL: $1"
  exit 1
}

echo "[1/8] Required files..."

test -f LICENSE || fail "LICENSE missing"
test -f README.md || fail "README.md missing"
test -f .env.example || fail ".env.example missing"
test -f docs/adr/001-stack.md || fail "ADR-001 missing"
test -f docs/adr/002-trust-ladder-and-invariants.md || fail "ADR-002 missing"
test -f docs/devlog.md || fail "docs/devlog.md missing"
test -f docs/spikes/day1-sandbox.md || fail "day1 sandbox spike missing"
test -f scripts/day1-sandbox-check.mjs || fail "sandbox check script missing"

echo "✓ Required files exist"

echo
echo "[2/8] .env safety..."

git check-ignore -q .env || fail ".env is NOT ignored"
git ls-files --error-unmatch .env >/dev/null 2>&1 && fail ".env is tracked"

echo "✓ .env is ignored and untracked"

echo
echo "[3/8] Secret scan in tracked files..."

if git grep -nE 'PAYPAL_CLIENT_SECRET=[^[:space:]]+' -- ':!docs/spikes/day1-sandbox.md' ':!README.md' >/dev/null 2>&1; then
  fail "Possible PayPal client secret found in tracked files"
fi

echo "✓ No obvious PayPal client secret in tracked files"

echo
echo "[4/8] Git history secret scan..."

if git log -p --all -- .env | grep -E 'PAYPAL_CLIENT_SECRET=' >/dev/null 2>&1; then
  fail "Possible .env/secret content exists in git history"
fi

echo "✓ No .env history detected"

echo
echo "[5/8] PayPal Sandbox check..."

node --env-file=.env scripts/day1-sandbox-check.mjs

echo
echo "✓ PayPal Sandbox check passed"

echo
echo "[6/8] Git status..."

git status --short

echo
echo "[7/8] Recent commits..."

git log --oneline -5

echo
echo "[8/8] Day 1 tag..."

git tag --list day-01

echo
echo "=== Day 1 verification complete ==="
echo "If all checks above are green, Day 1 is ready."