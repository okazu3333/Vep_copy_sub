import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'SalesGuard Alerts',
  description: 'Alert analysis and dashboard',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-background text-foreground">
        {children}
      </body>
    </html>
  )
} 