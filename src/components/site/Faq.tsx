'use client';

import { AnimatePresence, motion } from 'motion/react';
import { Plus } from 'lucide-react';
import { useId, useState } from 'react';
import { cn } from 'cn';
import { Reveal } from './Reveal';
import { SITE } from './siteCopy';

const EASE = [0.2, 0, 0, 1] as const;

/** Accordion of common questions. One answer open at a time; each header is a real button. */
export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  const base = useId();

  return (
    <section id="faq" aria-labelledby="faq-title" className="site-ambient relative isolate scroll-mt-6 overflow-hidden px-4 py-20 sm:px-6 sm:py-28">
      <div aria-hidden="true" className="pointer-events-none absolute top-1/3 left-1/2 -z-10 h-80 w-[min(760px,110vw)] -translate-x-1/2 rounded-full bg-glow-blue/25 blur-[110px]" />
      <div className="mx-auto grid max-w-[1100px] gap-10 md:grid-cols-[1fr_1.6fr]">
        <h2 id="faq-title" className="text-[clamp(36px,5vw,60px)] leading-[1.02] font-[450] tracking-[-0.04em] text-ink">
          Questions, <span className="font-serif font-normal tracking-normal text-[#A9C3FF] italic">answered</span>
        </h2>

        <Reveal delay={0.1}>
        <ul className="glass flex flex-col rounded-[22px] p-2">
          {SITE.faq.map((item, i) => {
            const isOpen = open === i;
            const panelId = `${base}-panel-${i}`;
            const buttonId = `${base}-button-${i}`;
            return (
              <li key={item.q} className={cn(i > 0 && 'border-t border-white/10')}>
                <h3>
                  <button
                    id={buttonId}
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => setOpen(isOpen ? null : i)}
                    className="flex min-h-14 w-full items-center justify-between gap-4 rounded-[14px] px-4 py-3 text-left text-base font-medium text-ink transition-colors hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {item.q}
                    <motion.span
                      aria-hidden="true"
                      animate={{ rotate: isOpen ? 45 : 0 }}
                      transition={{ duration: 0.2, ease: EASE }}
                      className="flex size-8 shrink-0 items-center justify-center rounded-full border border-white/20 text-[#A9C3FF]"
                    >
                      <Plus className="size-4" />
                    </motion.span>
                  </button>
                </h3>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      id={panelId}
                      role="region"
                      aria-labelledby={buttonId}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.24, ease: EASE }}
                      className="overflow-hidden"
                    >
                      <p className="max-w-[65ch] px-4 pb-5 text-[15px] leading-6 text-ink-muted">{item.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </li>
            );
          })}
        </ul>
        </Reveal>
      </div>
    </section>
  );
}
