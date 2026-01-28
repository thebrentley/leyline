import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Leyline | MTG Everything. Connected',
  description: 'Begin with an edge. The line between you and better Magic.',
  icons: {
    icon: '/favicon.svg',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
