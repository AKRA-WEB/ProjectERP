/* eslint-disable local-rules/no-hardcoded-thai */
import type { Metadata } from 'next';
import { SessionProvider } from 'next-auth/react';
import { IBM_Plex_Sans_Thai, IBM_Plex_Mono } from 'next/font/google';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { LanguageProvider } from '@/lib/i18n';
import { ToastProvider } from '@/components/ui';
import './globals.css';

const ibmPlexSansThai = IBM_Plex_Sans_Thai({
  weight: ['300', '400', '500', '600', '700'],
  subsets: ['thai', 'latin'],
  display: 'swap',
  variable: '--font-sans',
});

const ibmPlexMono = IBM_Plex_Mono({
  weight: ['400', '500', '600'],
  subsets: ['latin'],
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
