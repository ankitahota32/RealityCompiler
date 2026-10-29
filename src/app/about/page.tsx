import type { Metadata } from 'next';
import { Check } from 'lucide-react';
import { PageIntro, SERIF_ACCENT } from '@/components/site/PageIntro';
import { SiteButton } from '@/components/site/SiteButton';
import { SiteFooter } from '@/components/site/SiteFooter';
import { SiteNav } from '@/components/site/SiteNav';
import { ABOUT, SITE } from '@/components/site/siteCopy';

export const metadata: Metadata = {
  title: 'About us · RealityCompiler',
  description: ABOUT.lead,
};

export default function AboutPage() {
  return (
    <>
      <SiteNav />
      <main className="flex flex-col">
        <PageIntro badge={ABOUT.badge} lead={ABOUT.lead}>
          Built for the <span className={SERIF_ACCENT}>moment before</span> the code
        </PageIntro>

        <section aria-label={ABOUT.badge} className="px-4 pb-16 sm:px-6">
          <ul className="mx-auto grid max-w-[1100px] gap-4 md:grid-cols-3">
            {ABOUT.sections.map((s, i) => (
              <li key={s.title} className="glass group flex flex-col gap-3 rounded-[22px] p-6 transition-[transform,border-color] duration-300 hover:-translate-y-1 hover:border-white/25">
                <span aria-hidden="true" className="font-mono text-xs tracking-widest text-[#8FB6FF]">0{i + 1}</span>
                <h2 className="text-xl font-semibold tracking-[-0.02em] text-ink">{s.title}</h2>
                <p className="text-[15px] leading-6 text-ink-muted">{s.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="promise-title" className="px-4 pb-24 sm:px-6">
          <div className="relative isolate mx-auto flex max-w-[1100px] flex-col gap-8 overflow-hidden rounded-[28px] border border-white/10 bg-black p-6 sm:p-10 md:flex-row md:items-center md:justify-between">
            <div aria-hidden="true" className="absolute -right-24 -bottom-24 -z-10 size-80 rounded-full bg-glow-blue/50 blur-[90px]" />
            <div className="flex flex-col gap-5">
              <h2 id="promise-title" className="text-[clamp(28px,4vw,40px)] font-[450] tracking-[-0.03em] text-ink">{ABOUT.principlesTitle}</h2>
              <ul className="flex flex-col gap-3">
                {ABOUT.principles.map((p) => (
                  <li key={p} className="flex items-start gap-3 text-[15px] leading-6 text-ink">
                    <Check aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-glow-cyan" />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
            <SiteButton href="/app" className="shrink-0">{SITE.getStarted}</SiteButton>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
