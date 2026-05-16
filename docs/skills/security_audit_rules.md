---
type: skill
domain: security
agent: meena
load-when: "security audit, Vercel performance, OWASP, auth guard, SQL injection, bundle size, re-render"
---

# Security & Performance Audit Rules

**ใช้เมื่อ:** audit security vulnerabilities หรือ Vercel performance anti-patterns ใน Next.js 15 App Router

---

## Checklist — Authentication & Authorization
- [ ] Every API route calls `auth()` + checks `session?.user` before any logic
- [ ] `session.user` cast as `unknown as SessionUser` — never trust raw NextAuth types
- [ ] `assertRole()` called for all mutations (create/update/delete)
- [ ] `buildWarehouseScopeClause()` on every GET list endpoint
- [ ] `NEXTAUTH_SECRET` via env var — never hardcoded

## Checklist — SQL Injection
- [ ] All SQL uses `$1, $2` parameterized — zero string interpolation
- [ ] Dynamic WHERE built via arrays, not string concat
- [ ] `LIKE` uses parameterized `$N` with `%` in JS: `'%' + val + '%'`

## Checklist — Input Validation
- [ ] All POST/PATCH bodies validated with Zod before DB touch
- [ ] Zod errors via `apiValidationError()` — no raw error messages
- [ ] UUIDs validated as `.uuid()` before SQL use

## Checklist — Error Handling & Leakage
- [ ] API errors via `apiError('message', status)` — no stack traces in responses
- [ ] `console.error` never logs passwords, tokens, or PII
- [ ] 500 errors return generic messages, not raw DB error strings

## Checklist — Vercel Performance (Critical)
- [ ] Independent DB queries use `Promise.all()` — not sequential awaits
- [ ] Heavy components (charts, PDF, Excel) use `next/dynamic`
- [ ] `next/image` for all `<img>` tags
- [ ] `next/link` for all internal navigation
- [ ] No sensitive env vars with `NEXT_PUBLIC_` prefix

## Severity
| Level | When |
|-------|------|
| 🔴 Critical | Active security vuln or Vercel cost/crash risk |
| 🟡 High | Performance degradation under load or security hardening gap |
| 🔵 Medium | Best practice deviation, no immediate risk |

## Constraints
- Evidence first: quote `file:line` for every finding — no speculation
- Scope: security + performance only — not business logic or UI design
- Full checklist in `Meena.agent.md` — load that for complete audit

---

## Patterns & Traps — Captured in Field

<!-- Claude and Meena append here after each audit. Format:
## ✅ Pattern — [name]   or   ## ❌ Trap — [name]
-->
