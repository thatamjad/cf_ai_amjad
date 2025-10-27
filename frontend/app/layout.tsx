import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'AI Agent - Intelligent Conversation Assistant',
  description: 'Powered by Cloudflare Workers AI with advanced memory and reasoning capabilities',
  keywords: ['AI', 'Agent', 'Chatbot', 'Cloudflare', 'Machine Learning'],
  authors: [{ name: 'Your Name' }],
  creator: 'AI Agent Team',
  publisher: 'AI Agent Platform',
  robots: 'index, follow',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    title: 'AI Agent - Intelligent Conversation Assistant',
    description: 'Powered by Cloudflare Workers AI with advanced memory and reasoning capabilities',
    siteName: 'AI Agent Platform',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI Agent - Intelligent Conversation Assistant',
    description: 'Powered by Cloudflare Workers AI with advanced memory and reasoning capabilities',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20">
          {children}
        </div>
      </body>
    </html>
  );
}
