'use client';

import { animate, motion, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';
import type { Decision, Finding, Severity, StateMachine } from '@/core/types';
import { COPY } from './copy';
import { FindingCard, SeverityBadge } from './FindingCard';
import { MatrixTable } from './MatrixTable';
import { Button } from './ui/button';
import { decidedCount } from './wizardState';

const EASE = [0.2, 0, 0, 1] as const;
const ANIMATED_CARDS = 8;

/** A number that counts up from 0 once when it first appears (design.md §4 rule 2). */
function CountUp({ value }: { value: number }) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(0);
  const [arrived, setArrived] = useState(Boolean(reduced));
  useEffect(() => {
    if (arrived) return;
    const controls = animate(0, value, {
      duration: 0.32,
      ease: EASE,
      onUpdate: (v) => setShown(Math.round(v)),
      onComplete: () => setArrived(true),
    });
    return () => controls.stop();
  }, [value, arrived]);
  return <>{arrived ? value : shown}</>;
}

/** Step 3: summary bar, completeness table toggle, sorted finding cards, Build my spec. */
export function FindingsPanel({
  machine,
  findings,
  decisions,
  aiUnavailable,
  busy,
  onDecide,
  onClear,
  onBuild,
}: {
  machine: StateMachine;
  findings: Finding[];
  decisions: Decision[];
  aiUnavailable: boolean;
  busy: boolean;
  onDecide: (d: Decision) => void;
  onClear: (findingId: string) => void;
  onBuild: () => void;
}) {
  const [showMatrix, setShowMatrix] = useState(false);
  const total = findings.length;
  const decided = decidedCount(findings, decisions);
  const bySeverity = (s: Severity) => findings.filter((f) => f.severity === s).length;
  const decisionFor = (id: string) => decisions.find((d) => d.findingId === id);
  const labels = (ids: string[]) => ids.map((id) => machine.states.find((s) => s.id === id)?.label ?? id);

  return (
    <div className="flex flex-col gap-4">
      <section aria-label="Summary" className="flex flex-col gap-3 glass-panel p-4">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {(['high', 'medium', 'low'] as const).map((s) => (
            <span key={s} className="flex items-center gap-2 text-sm text-ink">
              <SeverityBadge severity={s} />
              <span className="font-semibold tabular-nums"><CountUp value={bySeverity(s)} /></span>
            </span>
          ))}
          <span className="text-sm text-ink sm:ml-auto">{COPY.decided(decided, total)}</span>
        </div>
        {/* Severity breakdown; fills once on arrival. The counts above carry the same information as text. */}
        <div className="h-1.5 overflow-hidden rounded-full bg-line" aria-hidden="true">
          <motion.div
            className="flex h-full origin-left"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.32, ease: EASE }}
          >
            <span className="h-full bg-sev-high" style={{ flexGrow: bySeverity('high') }} />
            <span className="h-full bg-sev-medium" style={{ flexGrow: bySeverity('medium') }} />
            <span className="h-full bg-sev-low" style={{ flexGrow: bySeverity('low') }} />
          </motion.div>
        </div>
      </section>

      {aiUnavailable && <p role="status" className="glass-panel p-3 text-sm text-ink">{COPY.aiUnavailable}</p>}

      <div>
        <Button type="button" variant="outline" aria-pressed={showMatrix} aria-expanded={showMatrix} onClick={() => setShowMatrix((v) => !v)}>
          {COPY.showMatrix}
        </Button>
      </div>
      {showMatrix && <MatrixTable machine={machine} />}

      {total === 0 && <p role="status" className="glass-panel p-3 text-sm text-ink">{COPY.noFindings}</p>}

      <ul className="flex flex-col gap-3">
        {findings.map((f, i) => (
          <motion.li
            key={f.id}
            // Arrival: the first 8 cards fade and rise once, 40 ms apart; the rest appear at once.
            initial={i < ANIMATED_CARDS ? { opacity: 0, y: 8 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, ease: EASE, delay: 0.32 + i * 0.04 }}
          >
            <FindingCard
              finding={f}
              stateLabels={labels(f.stateIds)}
              decision={decisionFor(f.id)}
              onDecide={onDecide}
              onClear={() => onClear(f.id)}
            />
          </motion.li>
        ))}
      </ul>

      <div className="flex flex-col items-stretch gap-2 sm:items-end">
        {total - decided > 0 && <p className="text-sm text-ink-muted">{COPY.willStayOpen(total - decided)}</p>}
        <Button type="button" disabled={busy} onClick={onBuild} className="w-full sm:w-auto">{COPY.buildSpec}</Button>
      </div>
    </div>
  );
}
