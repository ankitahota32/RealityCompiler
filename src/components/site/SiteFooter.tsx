import Link from 'next/link';
import { COPY } from '../copy';
import { LogoMark } from './LogoMark';
import { REPO_URL, SITE } from './siteCopy';

const LINK = 'rounded-sm text-sm text-ink-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/** Footer shared by the site pages. */
export function SiteFooter() {
  return (
    <footer className="relative overflow-hidden border-t border-line/60 bg-paper">
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-40 left-1/2 h-72 w-[min(900px,120vw)] -translate-x-1/2 rounded-full bg-glow-blue/30 blur-[100px]" />
      <div className="relative mx-auto grid max-w-[1200px] gap-10 px-4 py-14 sm:px-6 md:grid-cols-[2fr_1fr_1fr]">
        <div className="flex max-w-sm flex-col gap-3">
          <p className="flex items-center gap-2 text-[15px] font-medium text-ink">
            <LogoMark className="size-6 text-ink" />
            {COPY.productName}
          </p>
          <p className="text-sm text-ink-muted">{SITE.footerLine}</p>
        </div>
        <nav aria-label={SITE.footerProduct} className="flex flex-col gap-3">
          <p className="font-mono text-xs tracking-widest text-ink-muted uppercase">{SITE.footerProduct}</p>
          <Link href="/app" className={LINK}>{SITE.getStarted}</Link>
          <Link href="/#how-it-works" className={LINK}>{SITE.footerHowItWorks}</Link>
          <Link href="/#faq" className={LINK}>{SITE.footerFaq}</Link>
        </nav>
        <nav aria-label={SITE.footerCompany} className="flex flex-col gap-3">
          <p className="font-mono text-xs tracking-widest text-ink-muted uppercase">{SITE.footerCompany}</p>
          <Link href="/about" className={LINK}>About us</Link>
          <Link href="/contact" className={LINK}>Contact us</Link>
          <a href={REPO_URL} className={LINK} rel="noopener noreferrer" target="_blank">{SITE.footerSource}</a>
        </nav>
      </div>
      <div className="relative mx-auto flex max-w-[1200px] flex-col gap-2 border-t border-line/60 px-4 py-6 text-xs text-ink-muted sm:flex-row sm:justify-between sm:px-6">
        <p>© {new Date().getFullYear()} {COPY.productName}</p>
        <p>{SITE.footerNote}</p>
      </div>
      <p aria-hidden="true" className="relative select-none overflow-hidden text-center whitespace-nowrap font-serif text-[clamp(44px,13vw,200px)] leading-[0.8] text-white/[0.04] italic">
        {COPY.productName}
      </p>
    </footer>
  );
}
