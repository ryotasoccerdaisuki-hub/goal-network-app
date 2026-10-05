'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const links = [
  { href: '/', label: 'ホーム' },
  { href: '/goals', label: '目標一覧' },
  { href: '/actions', label: '行動一覧' },
]

export function NavBar() {
  const pathname = usePathname()
  return (
    <header className="border-b bg-background">
      <nav className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-4">
        <span className="font-bold">Goal Network</span>
        <div className="flex gap-4">
          {links.map((link) => {
            const active =
              link.href === '/' ? pathname === '/' : pathname.startsWith(link.href)
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'text-sm transition-colors hover:text-foreground',
                  active ? 'font-semibold text-foreground' : 'text-muted-foreground'
                )}
              >
                {link.label}
              </Link>
            )
          })}
        </div>
      </nav>
    </header>
  )
}
