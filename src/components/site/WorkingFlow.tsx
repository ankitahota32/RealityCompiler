import { FileText, MessagesSquare, ScanLine, Waypoints } from 'lucide-react';
import { DriftingGlow } from './DriftingGlow';
import { Reveal } from './Reveal';
import { SITE } from './siteCopy';

const ICONS = [ScanLine, Waypoints, MessagesSquare, FileText];
// Where each card's glow sits, so the four cards do not look identical (working-flow reference).
const GLOWS = [
  'right-[-30%] top-[25%] h-[90%] w-[70%]',
  'bottom-[-35%] left-[-10%] h-[70%] w-[110%]',
  'right-[-35%] top-[-35%] h-[85%] w-[110%]',
  'bottom-[-30%] left-[-35%] h-[80%] w-[85%]',
];

/** "Our Working Flow": four liquid-glass cards, one per wizard step, each with a slowly drifting glow. */
export function WorkingFlow() {
  return (
    <section id="how-it-works" aria-labelledby="flow-title" className="site-ambient relative isolate scroll-mt-6 px-4 py-16 sm:px-6 sm:py-24">
      <div aria-hidden="true" className="pointer-events-none absolute top-0 left-1/2 -z-10 h-64 w-[min(900px,110vw)] -translate-x-1/2 rounded-full bg-glow-blue/20 blur-[110px]" />
      <div className="mx-auto max-w-[1200px] rounded-[32px] border border-white/[0.08] bg-black/80 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-sm sm:p-10">
        <h2 id="flow-title" className="mb-8 text-[clamp(32px,5vw,52px)] leading-tight font-bold tracking-[-0.04em] sm:mb-10">
          <span className="bg-gradient-to-r from-[#E9FBFF] to-[#BDEBFF] bg-clip-text text-transparent">{SITE.flowTitleStart} </span>
          <span className="bg-gradient-to-r from-[#DFF3FF] via-[#8FB8FF] to-[#3D5BFF] bg-clip-text text-transparent">{SITE.flowTitleAccent}</span>
          <span className="bg-gradient-to-r from-[#E6ECFF] to-[#C9D3F5] bg-clip-text text-transparent"> {SITE.flowTitleEnd}</span>
        </h2>

        <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {SITE.flow.map((step, i) => {
            const Icon = ICONS[i] ?? FileText;
            return (
              <li key={step.title}>
                <Reveal delay={i * 0.08} className="h-full">
                  <div className="group relative isolate h-full min-h-[320px] overflow-hidden rounded-[26px] border border-white/10 bg-[#141826] transition-[transform,border-color] duration-300 hover:-translate-y-1.5 hover:border-white/25">
                    <DriftingGlow className={GLOWS[i]} />
                    {/* Glass sheen over the glow: soft frost plus a bright top edge. */}
                    <div
                      aria-hidden="true"
                      className="absolute inset-0 rounded-[26px] bg-[linear-gradient(160deg,rgba(255,255,255,0.08),rgba(20,24,38,0.35)_45%,rgba(20,24,38,0.15))] shadow-[inset_0_1px_0_rgba(255,255,255,0.22),inset_0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur-[6px]"
                    />
                    <div className="relative flex h-full flex-col justify-between gap-10 p-6">
                      <span className="flex size-12 items-center justify-center rounded-full border border-white/40 bg-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.3)] transition-transform duration-500 group-hover:rotate-[30deg] group-hover:scale-105">
                        <Icon aria-hidden="true" className="size-6 text-white/85" strokeWidth={1.4} />
                      </span>
                      <div className="flex flex-col gap-2 [text-shadow:0_1px_12px_rgba(5,8,20,0.6)]">
                        <h3 className="text-[32px] leading-none font-bold tracking-[-0.03em] text-white">{step.title}</h3>
                        <p className="font-mono text-xs tracking-wider text-[#BFD3FF] uppercase">{step.name}</p>
                        <p className="text-[15px] leading-6 text-[#E3E9F7]">{step.body}</p>
                      </div>
                    </div>
                  </div>
                </Reveal>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
