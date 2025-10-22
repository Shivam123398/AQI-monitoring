import '@/styles/globals.css';
import { Inter } from 'next/font/google';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import Header from '@/components/layout/Header';
import { ClientProviders } from '@/components/providers/ClientProviders';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'AeroGuard AI - Predict the air. Protect your health.',
  description: 'Hyperlocal air quality monitoring with AI-powered forecasting and health risk analysis',
  manifest: '/manifest.json',
};

export const viewport = {
  themeColor: '#667eea',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <ClientProviders>
            <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
              <Header />
              <main className="container mx-auto px-4 py-8">
                {children}
              </main>
            </div>
          </ClientProviders>
        </ThemeProvider>
      </body>
    </html>
  );
}
