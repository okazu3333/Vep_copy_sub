import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"

const inter = Inter({ 
  subsets: ["latin", "latin-ext"],
  display: 'swap',
  preload: true
})

export const metadata: Metadata = {
  title: "営業トラブルアラート - SalesGuard",
  description: "営業トラブルを未然に防ぐアラートシステム",
  generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
      </head>
      <body className={`${inter.className} font-japanese`} style={{fontFamily: '"Inter", "Hiragino Sans", "Yu Gothic", "Meiryo", sans-serif'}}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
            <Sidebar />
            <div className="flex-1 flex flex-col overflow-hidden">
              <Header />
              <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 dark:bg-gray-900">{children}</main>
            </div>
          </div>
        </ThemeProvider>
      </body>
    </html>
  )
}
