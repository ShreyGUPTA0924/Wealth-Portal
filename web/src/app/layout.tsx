import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';
import { QueryProvider } from '@/providers/QueryProvider';
import { LayoutTransition } from '@/components/ui/LayoutTransition';
import { ThemeProvider } from '@/providers/ThemeProvider';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist-sans' });

export const metadata: Metadata = {
  title: 'WealthPortal — India-First Wealth Management',
  description:
    'Track stocks, mutual funds, gold, crypto, PPF, EPF and all your investments in one place. AI-powered insights for Indian investors.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={geist.variable} suppressHydrationWarning>
      <body className="antialiased font-sans text-foreground bg-background transition-colors duration-300">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <QueryProvider>
            <LayoutTransition>{children}</LayoutTransition>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
