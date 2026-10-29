'use client';

import { motion } from 'motion/react';
import { STEP_TITLES } from './copy';
import type { Step } from './wizardState';

const STEPS: Step[] = [1, 2, 3, 4];

/** Wizard progress (four segments, the fill moves between steps) and the step title. */
export function StepHeader({ step }: { step: Step }) {
  return (
    <div className="flex flex-col gap-3">
      <ol className="grid grid-cols-4 gap-2" aria-label="Progress">
        {STEPS.map((n) => (
          <li key={n} aria-current={n === step ? 'step' : undefined} className="flex flex-col gap-1.5">
            <span className="relative h-1 overflow-hidden rounded-full bg-white/10">
              <motion.span
                className="absolute inset-0 origin-left bg-gradient-to-r from-glow-blue to-glow-cyan shadow-[0_0_12px_rgba(46,230,240,0.6)]"
                initial={false}
                animate={{ scaleX: n <= step ? 1 : 0 }}
                transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
              />
            </span>
            <span className={`font-mono text-xs tracking-wide transition-colors duration-200 ${n === step ? 'text-ink' : 'text-ink-muted'}`}>
              Step {n}
              <span className="sr-only">: {STEP_TITLES[n]}</span>
            </span>
          </li>
        ))}
      </ol>
      <h1 className="bg-gradient-to-b from-[#F2F7FF] to-[#A9C3FF] bg-clip-text text-[clamp(28px,4vw,40px)] leading-[1.1] font-[450] tracking-[-0.03em] text-transparent">{STEP_TITLES[step]}</h1>
    </div>
  );
}
