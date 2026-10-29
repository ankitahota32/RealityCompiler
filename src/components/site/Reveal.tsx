'use client';

import { motion } from 'motion/react';

/** Fades and rises its content once when it scrolls into view. MotionConfig keeps only the fade with reduced motion. */
export function Reveal({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -10% 0px' }}
      transition={{ duration: 0.5, ease: [0.2, 0, 0, 1], delay }}
    >
      {children}
    </motion.div>
  );
}
