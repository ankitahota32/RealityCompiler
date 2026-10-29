'use client';

import { animate, useReducedMotion } from 'motion/react';
import { useEffect, useRef } from 'react';
import { cn } from 'cn';

/**
 * A blurred blue-to-cyan glow that wanders slowly to random nearby spots.
 * Decorative only; it stays still when reduced motion is on.
 */
export function DriftingGlow({ className, range = 70 }: { className?: string; range?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el || reduced) return;
    let controls: ReturnType<typeof animate> | undefined;
    let stopped = false;
    const rand = (n: number) => (Math.random() * 2 - 1) * n;
    const next = () => {
      if (stopped) return;
      controls = animate(
        el,
        { x: rand(range), y: rand(range), scale: 0.85 + Math.random() * 0.35 },
        { duration: 2.5 + Math.random() * 2, ease: 'easeInOut', onComplete: next },
      );
    };
    next();
    return () => {
      stopped = true;
      controls?.stop();
    };
  }, [reduced, range]);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute rounded-full blur-[36px] will-change-transform',
        'bg-[radial-gradient(circle_at_center,#BFF4FF_0%,#4FB8FF_22%,#2F3BFF_50%,rgba(31,43,255,0)_72%)]',
        className,
      )}
    />
  );
}
