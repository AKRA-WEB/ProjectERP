import { query, queryOne } from '@/lib/db/client';

export interface HistoricalPoint {
  date: string;
  qty: number;
}

export interface ForecastDailyPoint {
  date: string;
  qty: number;
  upper: number;
  lower: number;
}

export interface ForecastResult {
  productId: string;
  sku: string;
  name_th: string;
  name_en: string;
  history: HistoricalPoint[];
  forecast: ForecastDailyPoint[];
}

/**
 * Computes a seasonally adjusted demand forecast using an S-Curve (logistic growth/trend model)
 * based on the 12-month rolling sales history of a given product.
 * 
 * @param productId Product UUID to forecast
 * @param days Number of days in the future to forecast (default 90)
 */
export async function getSCurveForecast(productId: string, days: number = 90): Promise<ForecastResult | null> {
  // 1. Fetch product master info
  const product = await queryOne<{ id: string; sku: string; name_th: string; name_en: string }>(
    `SELECT id, sku, name_th, name_en FROM products WHERE id = $1 AND is_active = TRUE`,
    [productId]
  );
  if (!product) return null;

  // 2. Fetch rolling 12-month sales grouped by month
  // We use DATE_TRUNC to group sales and ensure we have continuous data
  const historyRows = await query<{ sales_month: string; qty: string }>(
    `WITH months AS (
       SELECT DATE_TRUNC('month', g)::DATE AS sales_month
       FROM generate_series(
         DATE_TRUNC('month', NOW() - INTERVAL '11 months'),
         DATE_TRUNC('month', NOW()),
         INTERVAL '1 month'
       ) g
     ),
     sales AS (
       SELECT
         DATE_TRUNC('month', created_at)::DATE AS sales_month,
         -SUM(qty_change) AS qty
       FROM stock_ledger
       WHERE product_id = $1
         AND entry_type IN ('pos_sale', 'so_delivery')
         AND created_at >= DATE_TRUNC('month', NOW() - INTERVAL '11 months')
       GROUP BY sales_month
     )
     SELECT
       m.sales_month,
       COALESCE(s.qty, 0.0)::double precision AS qty
     FROM months m
     LEFT JOIN sales s ON s.sales_month = m.sales_month
     ORDER BY m.sales_month ASC`,
    [productId]
  );

  const history: HistoricalPoint[] = historyRows.map((r) => ({
    date: new Date(r.sales_month).toISOString().split('T')[0],
    qty: Number(r.qty),
  }));

  // Calculate stats
  const totalSales = history.reduce((sum, h) => sum + h.qty, 0);
  const avgMonthlySales = totalSales / 12.0;

  const forecast: ForecastDailyPoint[] = [];
  const today = new Date();

  // If there are zero sales across 12 months, return zero forecast
  if (totalSales <= 0) {
    for (let i = 1; i <= days; i++) {
      const futureDate = new Date(today);
      futureDate.setDate(today.getDate() + i);
      forecast.push({
        date: futureDate.toISOString().split('T')[0],
        qty: 0,
        upper: 0,
        lower: 0,
      });
    }
    return {
      productId: product.id,
      sku: product.sku,
      name_th: product.name_th,
      name_en: product.name_en,
      history,
      forecast,
    };
  }

  // 3. Compute Seasonal Index (SI) for each of the 12 calendar months
  const monthlyAverages: Record<number, number> = {};
  history.forEach((h) => {
    const month = new Date(h.date).getMonth() + 1; // 1-indexed
    monthlyAverages[month] = (monthlyAverages[month] ?? 0) + h.qty;
  });

  const seasonalIndexes: Record<number, number> = {};
  for (let m = 1; m <= 12; m++) {
    const salesInMonth = monthlyAverages[m] ?? 0;
    // Base SI = sales / average. We clamp it between 0.3 and 3.0 to prevent outlier disruption
    const rawSI = salesInMonth / (avgMonthlySales + 0.001);
    seasonalIndexes[m] = Math.min(Math.max(rawSI, 0.3), 3.0);
  }

  // 4. Calculate trend slope using linear regression (x = 1..12, y = monthly sales qty)
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  for (let i = 0; i < 12; i++) {
    const x = i + 1;
    const y = history[i].qty;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  }
  const slope = (12 * sumXY - sumX * sumY) / (12 * sumXX - sumX * sumX);

  // 5. Compute carrying capacity K and lifecycle growth factor for S-curve
  // We project carrying capacity K for the next 90 days
  // lifecycleFactor adjusts baseline projection up or down based on trend slope
  const relativeSlope = slope / (avgMonthlySales + 0.001);
  const lifecycleFactor = Math.min(Math.max(1.0 + relativeSlope * 3.0, 0.5), 1.8);
  const baseSCurveDemand = 3.0 * avgMonthlySales * lifecycleFactor;

  // 6. Build the daily S-curve cumulative distribution
  // S(t) = K / (1 + exp(-k * (t - t0)))
  // Midpoint t0 is 45.0 (midway of 90 days)
  const t0 = days / 2.0;
  // Growth rate k adjusts slightly based on slope
  const k = Math.min(Math.max(0.06 + relativeSlope * 0.1, 0.03), 0.12);

  // Calculate daily derivatives (s(t) = S(t) - S(t-1)) and adjust by monthly seasonal index
  const dailyWeights: number[] = [];

  const cumulativeLogistic = (t: number): number => {
    return baseSCurveDemand / (1.0 + Math.exp(-k * (t - t0)));
  };

  for (let t = 1; t <= days; t++) {
    const s_t = cumulativeLogistic(t) - cumulativeLogistic(t - 1);
    
    // Map day to future month's seasonal index
    const futureDate = new Date(today);
    futureDate.setDate(today.getDate() + t);
    const month = futureDate.getMonth() + 1;
    const si = seasonalIndexes[month] ?? 1.0;

    dailyWeights.push(s_t * si);
  }

  // Normalize daily forecasts to sum exactly to carrying capacity baseSCurveDemand
  const totalWeight = dailyWeights.reduce((sum, w) => sum + w, 0.0) || 1.0;

  // Calculate sample standard deviation of historical sales to build the confidence band
  const sqDiffSum = history.reduce((sum, h) => sum + Math.pow(h.qty - avgMonthlySales, 2), 0);
  const stdDev = Math.sqrt(sqDiffSum / 12.0);
  const coeffOfVariation = Math.min(Math.max(stdDev / (avgMonthlySales + 0.001), 0.15), 0.45);

  for (let t = 1; t <= days; t++) {
    const futureDate = new Date(today);
    futureDate.setDate(today.getDate() + t);
    const dateStr = futureDate.toISOString().split('T')[0];

    // Forecast qty
    const qty = (dailyWeights[t - 1] / totalWeight) * baseSCurveDemand;

    // Confidence band scales out with sqrt(t) representing growing uncertainty over time
    const stdErrorFactor = 1.96 * coeffOfVariation * Math.sqrt(t / (days / 2.0));
    const upper = qty * (1.0 + stdErrorFactor);
    const lower = Math.max(0.0, qty * (1.0 - stdErrorFactor));

    forecast.push({
      date: dateStr,
      qty: Number(qty.toFixed(3)),
      upper: Number(upper.toFixed(3)),
      lower: Number(lower.toFixed(3)),
    });
  }

  return {
    productId: product.id,
    sku: product.sku,
    name_th: product.name_th,
    name_en: product.name_en,
    history,
    forecast,
  };
}
