'use client';

import { Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { cn } from 'cn';
import { COPY } from '../copy';
import { LogoMark } from './LogoMark';
import { SiteButton } from './SiteButton';
import { NAV_LINKS, SITE } from './siteCopy';

const LINK =
  'relative rounded-sm px-2 py-2 font-mono text-[13px] tracking-wide uppercase transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring after:absolute after:inset-x-2 after:bottom-1 after:h-px after:origin-left after:scale-x-0 after:bg-current after:transition-transform after:duration-200 hover:after:scale-x-100';

/** Top bar shared by every page: name, Home, About us, Contact us, Get started. */
export function SiteNav({ overlay = false }: { overlay?: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const linkClass = (href: string) =>
    cn(LINK, pathname === href ? 'text-ink after:scale-x-100' : 'text-ink-muted hover:text-ink');

  return (
    <header className={cn('z-30 w-full', overlay ? 'absolute inset-x-0 top-0' : 'relative border-b border-line/60')}>
      <nav aria-label="Main" className="mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="group flex items-center gap-2 rounded-sm text-[15px] font-medium text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <LogoMark className="size-6 text-ink transition-transform duration-300 group-hover:rotate-[20deg]" />
          {COPY.productName}
        </Link>

        <ul className="hidden items-center gap-6 md:flex">
          {NAV_LINKS.map((l) => (
            <li key={l.href}>
              <Link href={l.href} aria-current={pathname === l.href ? 'page' : undefined} className={linkClass(l.href)}>{l.label}</Link>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          <SiteButton href="/app" className="hidden h-10 px-4 sm:inline-flex">{SITE.getStarted}</SiteButton>
          <button
            type="button"
            aria-expanded={open}
            aria-controls="site-menu"
            aria-label={open ? SITE.closeMenu : SITE.openMenu}
            onClick={() => setOpen((v) => !v)}
            className="inline-flex size-11 items-center justify-center rounded-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </nav>

      {open && (
        <div id="site-menu" className="glass mx-4 mb-3 rounded-lg p-2 md:hidden">
          <ul className="flex flex-col">
            {NAV_LINKS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  aria-current={pathname === l.href ? 'page' : undefined}
                  onClick={() => setOpen(false)}
                  className={cn(linkClass(l.href), 'flex h-11 items-center px-3')}
                >
                  {l.label}
                </Link>
              </li>
            ))}
            <li className="p-1 sm:hidden">
              <SiteButton href="/app" className="w-full">{SITE.getStarted}</SiteButton>
            </li>
          </ul>
        </div>
      )}
    </header>
  );
}
