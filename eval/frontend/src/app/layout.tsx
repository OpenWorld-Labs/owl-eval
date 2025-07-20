import type { Metadata } from 'next'
import { StackProvider, StackTheme } from "@stackframe/stack";
import { stackServerApp } from "../stack";
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/toaster'
import { Navigation } from '@/components/navigation'
import { OrganizationProvider } from '@/lib/organization-context'
import { Suspense } from 'react'
import { Loader2 } from 'lucide-react'

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
            <Suspense fallback={
              <div className="min-h-screen flex items-center justify-center">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span>Loading...</span>
                </div>
              </div>
            }>
              <OrganizationProvider>
                <div className="min-h-screen bg-background">
                  <Navigation />
                  <main className="p-6">
                    {children}
                  </main>
                  <Toaster />
                </div>
              </OrganizationProvider>
            </Suspense>
          </StackTheme>
        </StackProvider>
      </body>
    </html>
  )
}