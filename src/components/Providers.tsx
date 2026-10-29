'use client';

import { MotionConfig } from 'motion/react';
import type { ReactNode } from 'react';

/** Wraps the app once so every motion animation honours the reduced-motion setting (design.md §4). */
export function Providers({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
