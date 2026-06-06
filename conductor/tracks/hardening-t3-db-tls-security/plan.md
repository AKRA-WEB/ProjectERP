---
track: hardening-t3-db-tls-security
phase: hardening-stabilization
sequence: 3
status: Planned
owner: Chen
created: 2026-06-06
updated: 2026-06-06
depends_on: []
estimate: S
tags: [security, database, tls, high]
spec: conductor/qa-reports/full-audit-2026-06-06.md
---

# Hardening T3 — DB TLS Certificate Validation (High / Security)

## Goal

`lib/db/client.ts:8` sets `ssl: { rejectUnauthorized: false }`, disabling TLS certificate validation on every DB connection → MITM exposure in production (Supabase). Restore certificate validation in production while keeping local dev frictionless.

Independent of other tracks — can run in parallel.

## Architecture

- Production: validate the server certificate against Supabase's CA.
- Local dev: keep `rejectUnauthorized: false` (self-signed/local Postgres) — gated by `NODE_ENV`.
- Supabase CA cert supplied via env (`DB_CA_CERT`, PEM string) so no cert file is committed.

## Tech Stack

`pg` Pool SSL options, env config.

## Acceptance Criteria

1. In production (`NODE_ENV === 'production'`), `rejectUnauthorized: true` with a CA chain.
2. Dev behavior unchanged (no cert required to run `npm run dev`).
3. `.env.example` documents `DB_CA_CERT`.
4. App still connects (manual smoke test against the real DB), `npm run build` passes.

---

## Files

| Action | Path |
|--------|------|
| Modify | `lib/db/client.ts` |
| Modify | `.env.example` |

---

## Tasks

### Task 1: Conditional SSL config

- [ ] **1.1** Read `lib/db/client.ts`. Confirm pool is a module singleton (it is) and is the only `new Pool` — grep `new Pool` to be sure no other place duplicates the insecure config.
```bash
git grep -n "new Pool" -- '*.ts'
```
- [ ] **1.2** Replace the `ssl` option:
```ts
const isProd = process.env.NODE_ENV === 'production';
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: process.env.DB_POOL_MAX ? parseInt(process.env.DB_POOL_MAX) : 10,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 5000,
  ssl: isProd
    ? { rejectUnauthorized: true, ca: process.env.DB_CA_CERT }
    : { rejectUnauthorized: false },
});
```
- [ ] **1.3** If `DB_CA_CERT` unset in prod, `ca` is `undefined` → pg falls back to system CA store. Document that Supabase users must paste the project CA into `DB_CA_CERT` (Supabase dashboard → Database → SSL → download cert).

### Task 2: Apply same fix to any other Pool instances

- [ ] **2.1** From the grep in 1.1, if migration runners / job scripts create their own `Pool` with `rejectUnauthorized: false`, apply the same conditional. (Check `lib/db/migrate.ts`, `lib/db/run-migrate.ts`.)

### Task 3: Document env + verify

- [ ] **3.1** Add to `.env.example` under production section:
```env
# Supabase CA certificate (PEM, single line with \n) — required for TLS validation in prod
# DB_CA_CERT="-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----"
```
- [ ] **3.2** `npm run build` passes. Manual: `npm run dev` connects locally with no cert.
- [ ] **3.3** Commit:
```bash
git add lib/db/client.ts .env.example lib/db/migrate.ts lib/db/run-migrate.ts
git commit -m "security(db): validate TLS cert in production, keep dev frictionless"
```

---

## Verification

```bash
git grep -n "rejectUnauthorized: false" -- '*.ts'   # only inside the dev branch of the ternary
npm run build
```
Manual smoke: dev server connects; (if a staging prod env is available) prod connects with `DB_CA_CERT` set and fails closed without it.

## Notes

- Do NOT commit any actual certificate. Env only.
- `stock_ledger` / data integrity untouched — connection-layer change only.
