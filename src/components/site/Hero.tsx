import { ArrowField } from './ArrowField';
import { SiteButton } from './SiteButton';
import { SiteNav } from './SiteNav';
import { SITE } from './siteCopy';

const SERIF = 'font-serif font-normal italic tracking-normal';

/** Landing hero: navbar over a ring of glowing arrows on a deep blue wash (hero reference). */
export function Hero() {
  return (
    <section
      aria-labelledby="hero-title"
      className="relative isolate flex min-h-[100svh] flex-col overflow-hidden"
      style={{
        background:
          'radial-gradient(ellipse 70% 45% at 50% 98%, #E4F3FF 0%, #9CC8FF 18%, #3F74E8 40%, rgba(20,50,150,0) 72%),' +
          'linear-gradient(180deg, #02040B 0%, #050C26 38%, #0A1F5C 78%, #1A3E9E 100%)',
      }}
    >
      <ArrowField />
      {/* Darkens the ring's centre a little so the headline stays readable over the arrows. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_42%_30%_at_50%_50%,rgba(3,6,20,0.75),transparent_75%)]" />

      {/* Fades into the page colour so the next section continues the same background. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-paper" />

      <SiteNav overlay />

      <div className="relative z-10 mx-auto flex w-full max-w-[1000px] flex-1 flex-col items-center justify-center gap-7 px-4 pt-24 pb-20 text-center">
        <p className="inline-flex items-center gap-2 rounded-sm border border-white/15 bg-[#0B1430]/70 px-3 py-1.5 font-mono text-[11px] tracking-wider text-[#CFE0FF] uppercase backdrop-blur-sm sm:text-xs">
          <span aria-hidden="true" className="size-1.5 animate-pulse bg-[#CFE0FF]" />
          {SITE.heroBadge}
        </p>

        <h1
          id="hero-title"
          className="bg-gradient-to-b from-[#E8F1FF] via-[#BCD5FF] to-[#8FB6FF] bg-clip-text text-[clamp(30px,5.2vw,64px)] leading-[1.06] font-[450] tracking-[-0.035em] text-transparent"
        >
          {/* Two lines on wide screens; each line wraps on its own on phones. */}
          <span className="block sm:whitespace-nowrap">Catch What Your <span className={SERIF}>Plan Forgot,</span></span>
          <span className="block sm:whitespace-nowrap"><span className={SERIF}>Before</span> You Write Code</span>
        </h1>

        <p className="max-w-[56ch] text-[15px] leading-6 text-[#C9D6F2] sm:text-base">{SITE.heroLead}</p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <SiteButton href="/app">{SITE.getStarted}</SiteButton>
          <SiteButton href="#how-it-works" variant="dark">{SITE.seeHow}</SiteButton>
        </div>
      </div>
    </section>
  );
}
