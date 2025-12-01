import type { Metadata } from 'next'
import './globals.css'
import { ThemeProvider } from '@/components/theme-provider'
import { Header } from '@/components/header'
import { Sidebar } from '@/components/sidebar'
import { Inter } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import { Suspense } from 'react'

const inter = Inter({ subsets: ['latin'] })

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
    <html lang="ja" suppressHydrationWarning>
      <body className={`${inter.className} min-h-screen bg-background text-foreground`}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <div className="flex min-h-screen">
            <Suspense fallback={<div className="w-64 bg-white border-r border-gray-200" />}>
              <Sidebar />
            </Suspense>
            <div className="flex-1 flex flex-col min-w-0">
              <Header />
              <main className="flex-1 min-w-0">
                {children}
              </main>
            </div>
          </div>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
} 