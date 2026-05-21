'use client';

import React from 'react';

/**
 * Fallback for ViewTransition component if not available in the current React version.
 * Smoothly degrades to just rendering children.
 */
export const ViewTransition = (React as { ViewTransition?: React.ComponentType<Record<string, unknown>> }).ViewTransition || 
  (({ children }: { children: React.ReactNode } & Record<string, unknown>) => <>{children}</>);

/**
 * Fallback for addTransitionType if not available.
 */
export const addTransitionType = (React as { addTransitionType?: (type: string) => void }).addTransitionType || 
  (() => {});

/**
 * Browser detection for startViewTransition
 */
export const startViewTransition = (callback: () => void) => {
  if (typeof document !== 'undefined' && 'startViewTransition' in document) {
    (document as unknown as { startViewTransition: (cb: () => void) => void }).startViewTransition(callback);
  } else {
    callback();
  }
};

export { useTransition } from 'react';

