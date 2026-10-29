import { CircleOff, CornerUpRight, EyeOff, Hourglass, RefreshCcw, type LucideIcon } from 'lucide-react';
import { cn } from 'cn';
import { SITE } from './siteCopy';
import { TiltCard } from './TiltCard';

const ICONS: LucideIcon[] = [Hourglass, RefreshCcw, EyeOff, CircleOff];
// Desktop positions around the big text (challenges reference). Phones stack the cards in a grid instead.
const SPOTS = [
  'md:left-[6%] md:top-[17%]',
  'md:left-[60%] md:top-[6%]',
  'md:left-[25%] md:top-[63%]',
  'md:left-[49%] md:top-[52%]',
];
const LINE = 'block';

function QuoteMark() {
  return <span aria-hidden="true" className="font-serif text-2xl leading-none text-white/90">&ldquo;</span>;
}

function CornerTag({ inverted = false }: { inverted?: boolean }) {
  return (
    <span aria-hidden="true" className={cn('flex size-6 items-center justify-center', inverted ? 'bg-white text-[#1F2BFF]' : 'bg-[#1F2BFF] text-white')}>
      <CornerUpRight className="size-3.5" strokeWidth={2.2} />
    </span>
  );
}

/** "you come to us with a (rough plan), we turn it into a real spec", with tilting glass quote cards. */
export function Challenges() {
  return (
    <section aria-labelledby="challenges-title" className="site-ambient relative isolate overflow-hidden px-4 py-20 sm:px-6 md:py-28">
      {/* Electric blue and cyan glows behind the text. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute top-[5%] left-[-10%] h-[85%] w-[75%] rounded-full bg-[#1F2BFF] opacity-80 blur-[120px]" />
        <div className="absolute top-[10%] left-[28%] h-[55%] w-[38%] rounded-full bg-[#2EE6D6] opacity-55 blur-[110px]" />
        <div className="absolute right-[-15%] bottom-[-20%] h-[60%] w-[55%] rounded-full bg-[#0E1A8F] opacity-70 blur-[120px]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_85%_10%,rgba(5,6,11,0.85),transparent_55%)]" />
        {/* Soft top and bottom edges so the glows blend into the sections around it. */}
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-paper to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-paper to-transparent" />
      </div>

      <div className="relative mx-auto max-w-[1200px] md:min-h-[640px]">
        <h2
          id="challenges-title"
          className="relative text-center text-[clamp(34px,7vw,100px)] leading-[0.95] font-normal tracking-[-0.055em] text-white"
        >
          <span className={LINE}>you come to us</span>
          <span className={LINE}>with a</span>
          <span className={cn(LINE, 'bg-gradient-to-r from-[#6E7BFF] to-[#A4ADFF] bg-clip-text font-serif tracking-[-0.02em] text-transparent italic')}>
            (rough plan),
          </span>
          <span className={LINE}>we turn it into</span>
          <span className={LINE}>a real spec</span>
        </h2>

        <ul aria-label={SITE.challengesLabel} className="mt-12 grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 md:mt-0 md:block">
          {SITE.challenges.map((c, i) => {
            const Icon = ICONS[i] ?? Hourglass;
            return (
              <li key={c.text} className={cn('md:absolute md:w-[180px]', SPOTS[i])}>
                <TiltCard className="flex h-full min-h-[190px] flex-col gap-3 border border-white/25 bg-white/[0.14] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_20px_40px_-20px_rgba(0,0,0,0.6)] backdrop-blur-md">
                  <div className="flex items-start justify-between">
                    <Icon aria-hidden="true" className="size-10 text-white/80" strokeWidth={1} />
                    <CornerTag />
                  </div>
                  <QuoteMark />
                  <p className="text-[13px] leading-[18px] text-white">{c.text}</p>
                </TiltCard>
              </li>
            );
          })}
        </ul>

        <div className="mt-4 md:absolute md:top-[40%] md:right-[1%] md:mt-0 md:w-[210px]">
          <TiltCard className="flex flex-col gap-3 bg-[#1F2BFF] p-5 shadow-[0_24px_60px_-20px_rgba(31,43,255,0.8)]">
            <div className="flex justify-end">
              <CornerTag inverted />
            </div>
            {SITE.challengesAnswer.map((t) => (
              <p key={t} className="text-[13px] leading-[18px] text-white">{t}</p>
            ))}
          </TiltCard>
        </div>
      </div>
    </section>
  );
}
