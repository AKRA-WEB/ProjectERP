import { auth } from '@/auth';
import { apiError } from '@/lib/api-response';
import { query, queryOne } from '@/lib/db/client';
import type { SessionUser } from '@/types';
import { exportExpress } from '@/lib/accounting/exporters/express';
import { exportFlowAccount } from '@/lib/accounting/exporters/flowaccount';
import { exportPeak } from '@/lib/accounting/exporters/peak';
import type { ExportRow } from '@/lib/accounting/exporters/types';

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  // Auditor and Admin are authorized
  if (!['admin', 'auditor'].includes(u.role)) {
    return apiError('Forbidden: Unauthorized role access', 403);
  }

  const { searchParams } = new URL(req.url);
  const format = searchParams.get('format');
  const fromDate = searchParams.get('from');
  const toDate = searchParams.get('to');

  if (!format || !['express', 'flowaccount', 'peak'].includes(format)) {
    return apiError('Bad Request: Invalid format parameter. Must be express, flowaccount, or peak', 400);
  }
  if (!fromDate || !toDate) {
    return apiError('Bad Request: Missing from or to date parameters', 400);
  }

  // 1. Create a pending export job in the DB for auditing
  const job = await queryOne<{ id: string }>(
    `INSERT INTO accounting_export_jobs (format, range_from, range_to, requested_by, status)
     VALUES ($1, $2, $3, $4, 'pending')
     RETURNING id`,
    [format, fromDate, toDate, u.id]
  );

  if (!job) {
    return apiError('Internal Server Error: Failed to create export job record', 500);
  }

  try {
    // 2. Query posted journal entry lines
    const rows = await query<ExportRow>(
      `SELECT je.entry_number, je.entry_date, je.description AS entry_description, je.entry_type,
              jel.debit_amount, jel.credit_amount, jel.description AS line_description,
              a.account_code, a.name_th AS account_name_th, a.name_en AS account_name_en
       FROM journal_entries je
       JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
       JOIN accounts a ON a.id = jel.account_id
       WHERE je.status = 'posted' AND je.entry_date >= $1 AND je.entry_date <= $2
       ORDER BY je.entry_date ASC, je.entry_number ASC, jel.line_number ASC`,
      [fromDate, toDate]
    );

    // 3. Process the file based on the format
    let result: { filename: string; mime: string; buffer: Buffer };
    if (format === 'express') {
      result = exportExpress(rows);
    } else if (format === 'flowaccount') {
      result = exportFlowAccount(rows);
    } else {
      result = exportPeak(rows);
    }

    // 4. Update the job as completed with metadata
    await query(
      `UPDATE accounting_export_jobs
       SET status = 'completed', completed_at = NOW(),
           output_meta = $1::jsonb
       WHERE id = $2`,
      [
        JSON.stringify({
          record_count: rows.length,
          filename: result.filename,
          size_bytes: result.buffer.length,
        }),
        job.id,
      ]
    );

    // 5. Stream download response
    return new Response(new Uint8Array(result.buffer), {
      headers: {
        'Content-Type': result.mime,
        'Content-Disposition': `attachment; filename="${result.filename}"`,
      },
    });

  } catch (error) {
    // Mark job as failed
    await query(
      `UPDATE accounting_export_jobs
       SET status = 'failed', completed_at = NOW(),
           output_meta = $1::jsonb
       WHERE id = $2`,
      [
        JSON.stringify({
          error_message: error instanceof Error ? error.message : 'Unknown error during export',
        }),
        job.id,
      ]
    );

    return apiError('Internal Server Error: Failed to generate export file', 500);
  }
}
