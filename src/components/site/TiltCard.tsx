'use client';

import { motion, useReducedMotion, useSpring } from 'motion/react';
import { cn } from 'cn';

const MAX_TILT = 10; // degrees
const SPRING = { stiffness: 220, damping: 20, mass: 0.6 };

/** A card that tilts slightly toward the pointer and settles back when it leaves. Off with reduced motion. */
export function TiltCard({ className, children }: { className?: string; children: React.ReactNode }) {
  const reduced = useReducedMotion();
  const rotateX = useSpring(0, SPRING);
  const rotateY = useSpring(0, SPRING);
  const scale = useSpring(1, SPRING);

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (reduced || e.pointerType !== 'mouse') return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    rotateY.set(px * MAX_TILT * 2);
    rotateX.set(-py * MAX_TILT * 2);
    scale.set(1.04);
  };
  const onLeave = () => {
    rotateX.set(0);
    rotateY.set(0);
    scale.set(1);
  };

  return (
    <motion.div
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      style={{ rotateX, rotateY, scale, transformPerspective: 700 }}
      className={cn('will-change-transform', className)}
    >
      {children}
    </motion.div>
  );
}
