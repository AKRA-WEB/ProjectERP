# BUYMORE ERP — State Machine Diagrams

## Purchase Request (PR)

```mermaid
stateDiagram-v2
    [*] --> draft
    draft --> submitted
    submitted --> manager_approved
    submitted --> rejected
    manager_approved --> admin_approved
    manager_approved --> rejected
    admin_approved --> converted_to_po
    rejected --> [*]
    converted_to_po --> [*]
```

---

## Purchase Order (PO)

```mermaid
stateDiagram-v2
    [*] --> draft
    draft --> sent
    sent --> partially_received
    sent --> fully_received
    partially_received --> fully_received
    fully_received --> invoiced
    invoiced --> paid
    paid --> closed
    sent --> cancelled
    closed --> [*]
    cancelled --> [*]
```

---

## Goods Receipt Note (GRN)

```mermaid
stateDiagram-v2
    [*] --> draft
    draft --> received
    received --> qc_passed
    received --> qc_failed
    qc_passed --> stocked
    qc_failed --> stocked : partial stock
    stocked --> [*]
```

---

## RMA / Claim

```mermaid
stateDiagram-v2
    [*] --> open
    open --> in_review
    in_review --> resolved
    resolved --> closed
    closed --> [*]
```

---

## Transfer

```mermaid
stateDiagram-v2
    [*] --> pending
    pending --> completed : atomic debit+credit
    completed --> [*]
```

---

## Cycle Count

```mermaid
stateDiagram-v2
    [*] --> open
    open --> counting
    counting --> pending_approval
    pending_approval --> approved
    approved --> closed
    closed --> [*]
```

---

## POS Session

```mermaid
stateDiagram-v2
    [*] --> open
    open --> closed : end shift
    closed --> [*]
```

---

## Sales Flow (SQ → SO → DO → SI → SR)

```mermaid
stateDiagram-v2
    [*] --> sales_quotation
    sales_quotation --> sales_order : confirmed
    sales_quotation --> cancelled
    sales_order --> delivery_order : pick & ship
    delivery_order --> sales_invoice : delivered
    sales_invoice --> sales_receipt : paid
    sales_receipt --> [*]
    cancelled --> [*]
```

---

## HR Leave Request

```mermaid
stateDiagram-v2
    [*] --> pending
    pending --> approved
    pending --> rejected
    approved --> [*]
    rejected --> [*]
```

---

## Business Rules (for API transition guards)

- **VAT:** `VAT_RATE = 0.07` in `lib/constants.ts`. All amounts THB. Never hardcode `0.07`.
- **Transfer:** atomic — debit source + credit destination in single transaction.
- **Cycle count approval:** stored proc `apply_cycle_count()` — never replicate in app code.
- **PO status:** auto-updates to `partially_received` / `fully_received` after GRN stocking.
- **Stock ledger:** insert-only. Trigger `sync_stock_balances()` auto-fires. Never UPDATE/DELETE.
- **Document numbers:** `next_doc_number(prefix, seq)` in PostgreSQL only — never app-side.

| Transition | Min Role |
|---|---|
| PR: submit | staff |
| PR: manager_approved | manager |
| PR: admin_approved | admin |
| PO: sent, invoiced, paid, closed, cancelled | manager |
| GRN: stocked | warehouse_staff |
| Transfer: complete | warehouse_staff |

---

## HR Payroll Run

```mermaid
stateDiagram-v2
    [*] --> draft
    draft --> confirmed
    confirmed --> paid
    paid --> [*]
```
