import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'FacturaSaaS - Sistema de Facturación',
  description: 'Sistema completo de facturación para empresas',
  manifest: '/manifest.json',
  themeColor: '#3b82f6',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'FacturaSaaS',
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: 'website',
    siteName: 'FacturaSaaS',
    title: 'FacturaSaaS - Sistema de Facturación',
    description: 'Sistema completo de facturación para empresas',
  },
  twitter: {
    card: 'summary',
    title: 'FacturaSaaS - Sistema de Facturación',
    description: 'Sistema completo de facturación para empresas',
  },
  icons: {
    icon: '/icon',
    apple: '/apple-icon',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="FacturaSaaS" />
        <meta name="msapplication-TileColor" content="#3b82f6" />
        <meta name="msapplication-tap-highlight" content="no" />
        <link rel="apple-touch-icon" href="/apple-icon" />
        <link rel="mask-icon" href="/icon" color="#3b82f6" />
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  )
}
