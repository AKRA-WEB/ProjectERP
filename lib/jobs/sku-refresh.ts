import pool from '@/lib/db/client';

export async function runSkuPerformanceRefreshJob(): Promise<{ success: boolean; message: string }> {
  const client = await pool.connect();
  try {
    // Refresh materialized view concurrently so it doesn't block read queries
    await client.query('REFRESH MATERIALIZED VIEW CONCURRENTLY sku_performance_snapshot');
    return { success: true, message: 'SKU performance snapshot refreshed successfully.' };
  } catch (err) {
    console.error('Failed to refresh SKU performance snapshot materialized view:', err);
    // If concurrent refresh fails (e.g. because it's first run or index issues), fallback to normal refresh
    try {
      console.warn('Attempting standard non-concurrent refresh fallback...');
      await client.query('REFRESH MATERIALIZED VIEW sku_performance_snapshot');
      return { success: true, message: 'SKU performance snapshot refreshed successfully (standard fallback).' };
    } catch (fallbackErr) {
      console.error('Standard refresh fallback failed too:', fallbackErr);
      throw fallbackErr;
    }
  } finally {
    client.release();
  }
}
