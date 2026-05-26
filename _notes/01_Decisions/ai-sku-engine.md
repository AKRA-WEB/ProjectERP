# Architectural Decision: AI SKU Performance & Forecasting Engine (V2.2)

- **Owner:** Chen (Architect) / Gemini (Implementer)
- **Status:** Approved
- **Created:** 2026-05-26
- **Domain:** WMS Analytics

---

## 1. Context & Business Need

As BUYMORE ERP scales, management requires data-driven decision-making tools to:
1. **Discontinue underperforming SKUs:** Identify and flag products that accumulate holding costs without generating healthy sell-through or gross margins.
2. **Forecast demand:** Intelligently predict inventory requirements for the next 90 days, taking into account rolling 12-month sales volumes and seasonal trends.

To achieve this without high computational overhead, we implement a **pure SQL & statistical-based analytical engine** rather than deploying external heavy ML models (e.g. Prophet, ARIMA), ensuring fast rendering times, zero external latency, and seamless deployment on standard PostgreSQL servers.

---

## 2. Technical Architecture & Database Schema

We define the core analytical structures in migration `064_ai_sku_engine.sql`:

```
┌───────────────────────────────────────┐
│     Transactional Tables              │
│  (pos_transaction_lines, do_line_items)│
└──────────────────┬────────────────────┘
                   │
                   ▼ (Materialized View Nightly Refresh)
┌───────────────────────────────────────┐
│     sku_performance_snapshot          │
│  aggregates metrics over last 30/365d │
└──────────────────┬────────────────────┘
                   │
                   ├───► VIEW: sku_cut_candidates
                   │     (Bottom decile score + reason codes)
                   │
                   ▼
┌───────────────────────────────────────┐
│     lib/forecasting/sCurve.ts         │
│  seasonally-adjusted S-curve forecast │
└───────────────────────────────────────┘
```

### 2.1 Materialized View: `sku_performance_snapshot`
Aggregates sales quantity, revenue, COGS, gross margin percentage, sell-through, and inventory days-on-hand per product for the last 30 and 365 days. 
- **Refresh rate:** Nightly.
- **Indexes:** Unique index on `product_id` to allow concurrently refreshing and ultra-fast queries.

### 2.2 Scored View: `sku_cut_candidates`
Scores all active SKUs on a 0–100 scale:
$$Score = (SellThrough \times 0.3) + (GrossMargin\% \times 0.3) + (\min(QtySold30d, 100) \times 0.4)$$
- **Decile Filter:** Surfaced candidates are restricted to the bottom 10% (`pct_rank <= 0.10`) of active SKUs.
- **Discontinuation Reason Codes:**
  - `LOW_SELL_THROUGH`: Sell-through rate < 10%
  - `STAGNANT_STOCK`: 30-day quantity sold is 0 while stock on hand > 0
  - `WEAK_MARGIN`: Gross margin rate is below 15% (for products with positive revenue)
  - `HIGH_DAYS_ON_HAND`: Inventory days-on-hand is greater than 180 days

---

## 3. Demand Forecasting Algorithm (S-Curve & Seasonal Index)

Implemented in `lib/forecasting/sCurve.ts`, the forecast for a given product covers 90 days in the future:
1. **Baseline Daily Sales:** Computed as average daily sales over the rolling 12-month history, multiplied by a linear regression trend factor to project growth or decay.
2. **Seasonal Adjustments (SI):** Historical sales are grouped by calendar month to establish a seasonal index for each month, capped between `[0.3, 3.0]`.
3. **Logistic Growth Curve (S-Curve):** Model cumulative sales over 90 days using the logistic growth curve:
   $$S(t) = \frac{K}{1 + e^{-k(t - t_0)}}$$
   Daily incremental demand is derived as the daily derivative $S(t) - S(t-1)$, adjusted by the target month's seasonal index, and normalized to sum exactly to the projected demand $K$.
4. **Fan-Chart Confidence Band:** Standard deviation of historical sales is used to calculate standard error, which scales with $\sqrt{t}$ to reflect increasing uncertainty in the future.

---

## 4. API Endpoints

- `GET /api/analytics/sku-performance` — returns paginated list of all products with complete snapshot performance metrics.
- `GET /api/analytics/sku-cut-candidates` — returns bottom decile products slated for discontinuation with discontinuation score and reason codes.
- `GET /api/forecast/[product_id]?days=90` — computes and returns next-90-day daily demand forecasting points, upper, and lower confidence limits.
