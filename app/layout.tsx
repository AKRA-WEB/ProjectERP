/* eslint-disable local-rules/no-hardcoded-thai */
import type { Metadata } from 'next';
import { SessionProvider } from 'next-auth/react';
import localFont from 'next/font/local';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { LanguageProvider } from '@/lib/i18n';
import { ToastProvider } from '@/components/ui';
import './globals.css';

// Self-hosted IBM Plex (Thai+Latin in one file per weight). Avoids the
// build-time fetch that next/font/google does — that fetch hangs/timeouts in
// sandboxed CI agents (e.g. Codex) where network is blocked. Files: app/fonts/.
const ibmPlexSansThai = localFont({
  src: [
    { path: './fonts/IBMPlexSansThai-Light.woff2', weight: '300', style: 'normal' },
    { path: './fonts/IBMPlexSansThai-Regular.woff2', weight: '400', style: 'normal' },
    { path: './fonts/IBMPlexSansThai-Medium.woff2', weight: '500', style: 'normal' },
    { path: './fonts/IBMPlexSansThai-SemiBold.woff2', weight: '600', style: 'normal' },
    { path: './fonts/IBMPlexSansThai-Bold.woff2', weight: '700', style: 'normal' },
  ],
  display: 'swap',
  variable: '--font-sans',
});

const ibmPlexMono = localFont({
  src: [
    { path: './fonts/IBMPlexMono-Regular.woff2', weight: '400', style: 'normal' },
    { path: './fonts/IBMPlexMono-Medium.woff2', weight: '500', style: 'normal' },
    { path: './fonts/IBMPlexMono-SemiBold.woff2', weight: '600', style: 'normal' },
  ],
  display: 'swap',
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'ระบบ ERP | BUYMORE',
  description: 'ระบบบริหารจัดการองค์กร BUYMORE (THAILAND) COMPANY LIMITED',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th" className={`${ibmPlexSansThai.variable} ${ibmPlexMono.variable}`}>
      <body className="antialiased">
        <SessionProvider>
          <LanguageProvider>
            <ToastProvider>
              {children}
              <SpeedInsights />
            </ToastProvider>
          </LanguageProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
