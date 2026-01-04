import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Building Health X | NYC building reality check',
  description:
    'A fast, decision-first building check: the last 30/90 days (and 1–3 years) of violations, complaints, and resident reviews—so you avoid surprises before you sign.',
  keywords: ['NYC', 'building', 'apartment', 'violations', 'complaints', 'heat', 'pests', 'noise', 'landlord', 'HPD', 'DOB', '311'],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  )
}
