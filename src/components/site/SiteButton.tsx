import Link from 'next/link';
import { cn } from 'cn';

const BASE =
  'inline-flex h-11 items-center justify-center gap-2 rounded-sm px-5 font-mono text-[13px] tracking-wide uppercase transition-all duration-200 hover:-translate-y-px active:translate-y-0 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

const VARIANTS = {
  light: 'bg-white text-[#05060B] shadow-[0_0_0_1px_rgba(255,255,255,0.6),0_0_24px_rgba(140,190,255,0.35)] hover:bg-[#DDE8FF] hover:shadow-[0_0_0_1px_rgba(255,255,255,0.7),0_0_34px_rgba(140,190,255,0.55)]',
  dark: 'border border-glass-line bg-[#0B0E1A]/80 text-ink hover:border-white/30 hover:bg-[#161B2E]',
} as const;

/** Mono uppercase link-button used on the site pages (hero reference). */
export function SiteButton({
  href,
  variant = 'light',
  className,
  children,
}: {
  href: string;
  variant?: keyof typeof VARIANTS;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={cn(BASE, VARIANTS[variant], className)}>
      {children}
    </Link>
  );
}
