import type { Metadata } from 'next';
import { ArrowUpRight, Bug, Code2, Mail, type LucideIcon } from 'lucide-react';
import { PageIntro, SERIF_ACCENT } from '@/components/site/PageIntro';
import { SiteFooter } from '@/components/site/SiteFooter';
import { SiteNav } from '@/components/site/SiteNav';
import { CONTACT, CONTACT_EMAIL, REPO_URL } from '@/components/site/siteCopy';

export const metadata: Metadata = {
  title: 'Contact us · RealityCompiler',
  description: CONTACT.lead,
};

const CHANNELS: { icon: LucideIcon; title: string; body: string; href: string; link: string; external: boolean }[] = [
  { icon: Mail, title: CONTACT.emailTitle, body: CONTACT.emailBody, href: `mailto:${CONTACT_EMAIL}`, link: CONTACT_EMAIL, external: false },
  { icon: Bug, title: CONTACT.issuesTitle, body: CONTACT.issuesBody, href: `${REPO_URL}/issues`, link: CONTACT.issuesLink, external: true },
  { icon: Code2, title: CONTACT.sourceTitle, body: CONTACT.sourceBody, href: REPO_URL, link: CONTACT.sourceLink, external: true },
];

export default function ContactPage() {
  return (
    <>
      <SiteNav />
      <main className="flex flex-col">
        <PageIntro badge={CONTACT.badge} lead={CONTACT.lead}>
          Let&apos;s <span className={SERIF_ACCENT}>talk</span> about your plan
        </PageIntro>

        <section aria-label={CONTACT.badge} className="px-4 pb-24 sm:px-6">
          <ul className="mx-auto grid max-w-[1100px] gap-4 md:grid-cols-3">
            {CHANNELS.map(({ icon: Icon, title, body, href, link, external }) => (
              <li key={title} className="glass group flex flex-col gap-4 rounded-[22px] p-6 transition-[transform,border-color] duration-300 hover:-translate-y-1 hover:border-white/25">
                <span className="flex size-12 items-center justify-center rounded-full border border-white/30 bg-white/[0.04]">
                  <Icon aria-hidden="true" className="size-5 text-ink" strokeWidth={1.5} />
                </span>
                <h2 className="text-xl font-semibold tracking-[-0.02em] text-ink">{title}</h2>
                <p className="flex-1 text-[15px] leading-6 text-ink-muted">{body}</p>
                <a
                  href={href}
                  {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  className="inline-flex min-h-11 items-center gap-1.5 self-start rounded-sm font-mono text-[13px] tracking-wide break-all text-[#A9C3FF] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {link}
                  <ArrowUpRight aria-hidden="true" className="size-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </a>
              </li>
            ))}
          </ul>
          <p className="mx-auto mt-8 max-w-[1100px] text-center text-sm text-ink-muted">{CONTACT.privacyNote}</p>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
