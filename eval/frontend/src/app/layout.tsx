import type { Metadata } from 'next'
import { StackProvider, StackTheme } from "@stackframe/stack";
import { stackServerApp } from "../stack";
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/toaster'
import { Navigation } from '@/components/navigation'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Owl Eval - Human Evaluation Platform',
  description: 'Advanced human evaluation platform for AI models and systems',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-background text-foreground`}>
        <StackProvider app={stackServerApp}>
          <StackTheme>
            <div className="min-h-screen bg-background">
              <Navigation />
              <main className="p-6">
                {children}
              </main>
              <Toaster />
            </div>
          </StackTheme>
        </StackProvider>
      </body>
    </html>
  )
}