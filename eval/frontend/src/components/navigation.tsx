'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useUser } from '@stackframe/stack'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { OrganizationSwitcher } from '@/components/organization-switcher'
import { 
  Home, 
  Settings, 
  BarChart3, 
  ExternalLink,
  ChevronRight,
  LogOut,
  User
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface NavigationProps {
  className?: string
}

export function Navigation({ className }: NavigationProps) {
  const pathname = usePathname()
  const user = useUser()

  const navItems = [
    {
      href: '/',
      label: 'Home',
      icon: <Home className="h-4 w-4" />,
      description: 'Participant evaluation interface'
    },
    {
      href: '/admin',
      label: 'Admin',
      icon: <Settings className="h-4 w-4" />,
      description: 'Experiment management dashboard',
      adminOnly: true
    }
  ]

  return (
    <nav className={`border-b bg-card border-border ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity glow">
              <div className="w-8 h-8 bg-gradient-to-br from-primary to-secondary rounded-lg flex items-center justify-center">
                <BarChart3 className="h-4 w-4 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-foreground">Owl Eval</h1>
                <p className="text-xs text-muted-foreground leading-none">Human Evaluation Platform</p>
              </div>
            </Link>
          </div>

          {/* Center Navigation Links */}
          <div className="flex items-center gap-6">
            {navItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive 
                      ? 'bg-primary/10 text-primary border border-primary/20 glow-text' 
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                  {item.adminOnly && (
                    <Badge variant="secondary" className="text-xs">
                      Protected
                    </Badge>
                  )}
                  {!isActive && (
                    <ExternalLink className="h-3 w-3 opacity-50" />
                  )}
                </Link>
              )
            })}
          </div>

          {/* Right side - Organization Switcher & User Menu */}
          <div className="flex items-center gap-4">
            {user && <OrganizationSwitcher />}
            
            {user ? (
              <UserMenu user={user} />
            ) : (
              <Button asChild variant="outline" size="sm">
                <Link href="/handler/sign-in">Sign In</Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}

function UserMenu({ user }: { user: any }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="flex items-center gap-2">
          <User className="h-4 w-4" />
          <span className="hidden sm:inline">{user.displayName || user.primaryEmail}</span>
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-2 py-1.5 text-sm">
          <p className="font-medium">{user.displayName || 'User'}</p>
          <p className="text-muted-foreground">{user.primaryEmail}</p>
        </div>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem asChild>
          <Link href="/handler/account-settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Account Settings
          </Link>
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem asChild>
          <Link href="/handler/sign-out" className="flex items-center gap-2 text-red-600">
            <LogOut className="h-4 w-4" />
            Sign Out
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

interface BreadcrumbsProps {
  items: Array<{
    label: string
    href?: string
  }>
  className?: string
}

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  return (
    <nav className={`flex items-center space-x-1 text-sm text-muted-foreground ${className}`}>
      {items.map((item, index) => (
        <div key={index} className="flex items-center">
          {index > 0 && <ChevronRight className="h-3 w-3 mx-1" />}
          {item.href ? (
            <Link 
              href={item.href} 
              className="hover:text-foreground transition-colors"
            >
              {item.label}
            </Link>
          ) : (
            <span className="text-foreground font-medium">{item.label}</span>
          )}
        </div>
      ))}
    </nav>
  )
}