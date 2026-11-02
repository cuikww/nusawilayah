import type { ReactNode } from 'react';
import '@nusawilayah/react/style.css';

export const metadata = { title: 'nusawilayah + Next.js' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id">
      <body style={{ fontFamily: 'system-ui, sans-serif', maxWidth: '40rem', margin: '2rem auto', padding: '0 1rem' }}>{children}</body>
    </html>
  );
}
