import type { Metadata } from 'next';
import './globals.css';
import { QueryProvider } from '@/providers/QueryProvider';
import { LayoutTransition } from '@/components/ui/LayoutTransition';
import { ThemeProvider } from '@/providers/ThemeProvider';
import { GoogleOAuthProvider } from '@react-oauth/google';

export const metadata: Metadata = {
  title: 'WealthPortal — India-First Wealth Management',
  description:
    'Track stocks, mutual funds, gold, crypto, PPF, EPF and all your investments in one place. AI-powered insights for Indian investors.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Always render GoogleOAuthProvider so useGoogleLogin hooks never throw.
  // If no real client ID is configured the Google buttons are hidden on the
  // login/register pages, so the flow is never actually triggered.
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || 'not-configured';

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased font-sans text-foreground bg-background transition-colors duration-300">
        <GoogleOAuthProvider clientId={clientId}>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <QueryProvider>
              <LayoutTransition>{children}</LayoutTransition>
            </QueryProvider>
          </ThemeProvider>
        </GoogleOAuthProvider>
      </body>
    </html>
  );
}
