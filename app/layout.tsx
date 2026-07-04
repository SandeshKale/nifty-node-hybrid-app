import './globals.css';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Nifty Auto-Trader v14',
  description: 'Nifty 50 F&O Options Analysis Dashboard',
};

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard' },
  { href: '/history', label: 'History' },
  { href: '/logs', label: 'Logs' },
  { href: '/settings', label: 'Settings' },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav className="border-b border-surface-border bg-surface-raised px-6 py-3 flex items-center gap-6">
          <span className="text-lg font-semibold text-white tracking-tight">Nifty v14</span>
          <div className="flex gap-4">
            {NAV_ITEMS.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </div>
          <div className="ml-auto">
            <Link
              href="/api/analyse"
              className="text-xs bg-accent-blue/20 text-accent-blue px-3 py-1.5 rounded hover:bg-accent-blue/30 transition-colors"
            >
              Run Analysis
            </Link>
          </div>
        </nav>
        <main className="max-w-7xl mx-auto px-6 py-6">{children}</main>
      </body>
    </html>
  );
}
