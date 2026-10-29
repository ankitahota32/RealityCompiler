import { DriftingGlow } from './DriftingGlow';

/** Top of the About and Contact pages: a mono badge and a mixed-type headline over a slow glow. */
export function PageIntro({ badge, children, lead }: { badge: string; children: React.ReactNode; lead: string }) {
  return (
    <section className="relative isolate overflow-hidden px-4 pt-16 pb-12 sm:px-6 sm:pt-24">
      <DriftingGlow range={80} className="top-[-40%] left-1/2 -z-10 h-[420px] w-[min(820px,120vw)] -translate-x-1/2 opacity-60" />
      <div className="mx-auto flex max-w-[900px] flex-col items-center gap-6 text-center">
        <p className="inline-flex items-center gap-2 rounded-sm border border-white/15 bg-[#0B1430]/70 px-3 py-1.5 font-mono text-xs tracking-wider text-[#CFE0FF] uppercase">
          <span aria-hidden="true" className="size-1.5 bg-[#CFE0FF]" />
          {badge}
        </p>
        <h1 className="bg-gradient-to-b from-[#F2F7FF] to-[#9FC0FF] bg-clip-text text-[clamp(38px,6.5vw,72px)] leading-[1.04] font-[450] tracking-[-0.035em] text-transparent">
          {children}
        </h1>
        <p className="max-w-[60ch] text-base text-ink-muted sm:text-lg">{lead}</p>
      </div>
    </section>
  );
}

export const SERIF_ACCENT = 'font-serif font-normal italic tracking-normal';
