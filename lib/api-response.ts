import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
}

export function apiError(message: string, status = 400, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status });
}

export function apiValidationError(error: ZodError) {
  return NextResponse.json(
    { error: 'Validation failed', details: error.issues },
    { status: 400 }
  );
}
