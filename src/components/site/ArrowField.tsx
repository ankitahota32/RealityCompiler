'use client';

import { useReducedMotion } from 'motion/react';
import { useEffect, useRef } from 'react';

type Arrow = {
  r: number; // distance from the ring centre
  a: number; // angle at rotation 0
  weight: number; // 0..1 brightness from the ring shape and the patch noise
  ox: number; // current push-away offset
  oy: number;
};

const SPRITE = 16; // CSS px per arrow cell
const TURN_SECONDS = 240; // one full rotation every four minutes
const REPEL_RADIUS = 120;
const REPEL_PUSH = 34;
const EASE = 0.1; // how fast an arrow follows its target offset each frame (smooth return)

/** Deterministic 0..1 hash so the pattern is the same on every load. */
function hash(x: number, y: number) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function makeSprite(dpr: number) {
  const c = document.createElement('canvas');
  c.width = c.height = Math.ceil(SPRITE * dpr);
  const g = c.getContext('2d');
  if (!g) return c;
  g.scale(dpr, dpr);
  g.strokeStyle = '#B4D0FF';
  g.lineWidth = 1.6;
  g.lineCap = 'square';
  g.shadowColor = 'rgba(110, 160, 255, 0.95)';
  g.shadowBlur = 5;
  g.beginPath();
  g.moveTo(4.5, 11.5);
  g.lineTo(11, 5);
  g.moveTo(6.5, 5);
  g.lineTo(11, 5);
  g.lineTo(11, 9.5);
  g.stroke();
  return c;
}

/**
 * Hero background: small glowing arrows arranged in a ring that turns slowly.
 * Arrows near the pointer ease away and settle back. Decorative only (aria-hidden);
 * with reduced motion it draws one still frame and ignores the pointer.
 */
export function ArrowField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !host || !ctx) return;

    let w = 0;
    let h = 0;
    let dpr = 1;
    let arrows: Arrow[] = [];
    let sprite = makeSprite(1);
    let rotation = 0;
    let pointer: { x: number; y: number } | null = null;
    let frame = 0;
    let last = 0;
    let visible = true;

    const centre = () => ({ x: w / 2, y: h * 0.5 });

    const build = () => {
      const rect = host.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      sprite = makeSprite(dpr);

      const step = w < 640 ? 10 : 12;
      const maxR = Math.hypot(w, h) / 2;
      const ringR = Math.min(w, h * 1.5) * 0.5;
      const sigma = ringR * 0.32;
      const patch = step * 3;
      arrows = [];
      for (let gy = -maxR; gy <= maxR; gy += step) {
        for (let gx = -maxR; gx <= maxR; gx += step) {
          const r = Math.hypot(gx, gy);
          if (r > maxR) continue;
          // Gaussian ring, plus a smooth cut-off so the centre (behind the headline) stays nearly empty.
          const inner = Math.min(1, Math.max(0, (r / ringR - 0.45) / 0.35));
          const ring = Math.exp(-((r - ringR) ** 2) / (2 * sigma * sigma)) * inner * inner * (3 - 2 * inner);
          const blotch = hash(Math.floor(gx / patch), Math.floor(gy / patch));
          const weight = ring * (0.25 + 0.75 * blotch) * (0.7 + 0.3 * hash(gx, gy));
          if (weight < 0.05) continue;
          arrows.push({ r, a: Math.atan2(gy, gx), weight, ox: 0, oy: 0 });
        }
      }
    };

    const draw = (animate: boolean) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const c = centre();
      const half = SPRITE / 2;
      for (const p of arrows) {
        const angle = p.a + rotation;
        const bx = c.x + p.r * Math.cos(angle);
        const by = c.y + p.r * Math.sin(angle);
        let tx = 0;
        let ty = 0;
        let near = 0;
        if (animate && pointer) {
          const dx = bx - pointer.x;
          const dy = by - pointer.y;
          const d = Math.hypot(dx, dy);
          if (d < REPEL_RADIUS && d > 0.001) {
            near = (1 - d / REPEL_RADIUS) ** 2;
            tx = (dx / d) * near * REPEL_PUSH;
            ty = (dy / d) * near * REPEL_PUSH;
          }
        }
        p.ox += (tx - p.ox) * EASE;
        p.oy += (ty - p.oy) * EASE;
        const x = bx + p.ox;
        const y = by + p.oy;
        if (x < -SPRITE || y < -SPRITE || x > w + SPRITE || y > h + SPRITE) continue;
        // Brighter towards the glow at the bottom, like the reference.
        const fade = 0.45 + 0.55 * Math.min(1, Math.max(0, y / h));
        ctx.globalAlpha = Math.min(1, p.weight * fade * 0.85 + near * 0.35);
        ctx.drawImage(sprite, x - half, y - half, SPRITE, SPRITE);
      }
      ctx.globalAlpha = 1;
    };

    const tick = (now: number) => {
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      rotation += (dt * 2 * Math.PI) / TURN_SECONDS;
      draw(true);
      frame = requestAnimationFrame(tick);
    };

    const start = () => {
      if (reduced || frame || !visible || document.hidden) return;
      last = 0;
      frame = requestAnimationFrame(tick);
    };
    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
    };

    build();
    draw(false);

    const resize = new ResizeObserver(() => {
      build();
      draw(false);
    });
    resize.observe(host);

    if (reduced) return () => resize.disconnect();

    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const onLeave = () => {
      pointer = null;
    };
    const onVisibility = () => (document.hidden ? stop() : start());
    const seen = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true;
      if (visible) start();
      else stop();
    });

    host.addEventListener('pointermove', onMove);
    host.addEventListener('pointerleave', onLeave);
    document.addEventListener('visibilitychange', onVisibility);
    seen.observe(host);
    start();

    return () => {
      stop();
      resize.disconnect();
      seen.disconnect();
      host.removeEventListener('pointermove', onMove);
      host.removeEventListener('pointerleave', onLeave);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [reduced]);

  return <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none absolute inset-0" />;
}
