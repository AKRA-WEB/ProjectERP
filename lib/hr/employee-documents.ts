export function validateDocReview(
  action: 'verify' | 'reject',
  body: { rejected_reason?: string | null }
): void {
  if (action === 'reject' && !body.rejected_reason?.trim()) {
    throw new Error('rejected_reason is required when rejecting a document');
  }
}

export function isDocExpired(
  doc: { expiry_date: string | null },
  asOf: Date = new Date()
): boolean {
  if (!doc.expiry_date) return false;
  return new Date(doc.expiry_date) < asOf;
}
