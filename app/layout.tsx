import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'CodeCast — Live coding sessions with AI annotations',
  description:
    'Write code live while viewers watch every keystroke in real-time. AI explains every change automatically.',
  keywords: ['live coding', 'code sharing', 'real-time', 'AI annotations', 'Monaco Editor'],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head />
      <body>{children}</body>
    </html>
  )
}
