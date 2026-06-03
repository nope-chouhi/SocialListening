import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/ThemeProvider'

const inter = Inter({ subsets: ['latin', 'vietnamese'] })

export const metadata: Metadata = {
  title: 'Nope',
  description: 'Nền tảng giám sát truyền thông, thu thập mentions, phân tích sắc thái và cảnh báo rủi ro.',
  applicationName: 'Nope',
  creator: 'Nope',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.svg',
  },
}

export const viewport = {
  themeColor: '#111827',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
