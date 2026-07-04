import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/ThemeProvider'
import { AuthProvider } from '@/contexts/AuthContext'
import { DialogProvider } from '@/components/ui/Dialog'
import { LanguageProvider } from '@/contexts/LanguageContext'

const inter = Inter({ subsets: ['latin', 'vietnamese'] })

export const metadata: Metadata = {
  title: 'Nope360',
  description: 'Nền tảng giám sát truyền thông, thu thập mentions, phân tích sắc thái và cảnh báo rủi ro.',
  applicationName: 'Nope360',
  creator: 'Nope360',
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
        <LanguageProvider>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <AuthProvider>
              <DialogProvider>
                {children}
              </DialogProvider>
            </AuthProvider>
          </ThemeProvider>
        </LanguageProvider>
      </body>
    </html>
  )
}
