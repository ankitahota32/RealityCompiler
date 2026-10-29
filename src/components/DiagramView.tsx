'use client';

import { useEffect, useMemo, useState } from 'react';
import { toMermaid } from '@/core/mermaid';
import type { StateMachine } from '@/core/types';
import { COPY } from './copy';
import { Button } from './ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';

let renderCount = 0;

/** The last drawing and the Mermaid text it was made from; a different text means "still drawing". */
type Drawn = { text: string } & ({ status: 'ok'; url: string; width: number; height: number } | { status: 'error' });

/** Size from the SVG viewBox so the <img> gets its real dimensions. */
function svgSize(svg: string): { width: number; height: number } {
  const m = /viewBox="[-\d.]+ [-\d.]+ ([\d.]+) ([\d.]+)"/.exec(svg);
  return m?.[1] && m[2] ? { width: Math.ceil(Number(m[1])), height: Math.ceil(Number(m[2])) } : { width: 800, height: 400 };
}

/** Transitions as a table: From · Event · To. All labels are plain text. */
export function TransitionList({ machine }: { machine: StateMachine }) {
  const state = (id: string) => machine.states.find((s) => s.id === id)?.label ?? id;
  const event = (id: string) => machine.events.find((e) => e.id === id)?.label ?? id;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{COPY.from}</TableHead>
          <TableHead>{COPY.event}</TableHead>
          <TableHead>{COPY.to}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {machine.transitions.map((t) => (
          <TableRow key={t.id}>
            <TableCell className="whitespace-normal">{state(t.from)}</TableCell>
            <TableCell className="whitespace-normal">{event(t.event)}</TableCell>
            <TableCell className="whitespace-normal">{state(t.to)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/**
 * Mermaid diagram on the drafting grid (SPEC §10.3). Mermaid is imported in useEffect only, runs with
 * securityLevel 'strict' and SVG text labels, and the result is shown as an <img> from a blob URL, so
 * nothing from the diagram is ever inserted as HTML. The height is reserved; it is never animated.
 */
export function DiagramView({ machine }: { machine: StateMachine }) {
  const [showList, setShowList] = useState(false);
  const [drawn, setDrawn] = useState<Drawn | null>(null);
  const text = useMemo(() => toMermaid(machine), [machine]);
  const status = drawn === null || drawn.text !== text ? 'loading' : drawn.status;

  useEffect(() => {
    if (showList) return;
    let cancelled = false;
    let url: string | undefined;
    (async () => {
      try {
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          htmlLabels: false,
          theme: 'dark', // the app is dark-only
          fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        });
        renderCount += 1;
        const { svg } = await mermaid.render(`rc-diagram-${renderCount}`, text);
        if (cancelled) return;
        url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
        setDrawn({ text, status: 'ok', url, ...svgSize(svg) });
      } catch {
        if (!cancelled) setDrawn({ text, status: 'error' });
      }
    })();
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [text, showList]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-end">
        <Button type="button" variant="outline" size="sm" aria-pressed={showList} onClick={() => setShowList((v) => !v)}>
          {COPY.showAsList}
        </Button>
      </div>
      {showList ? (
        <div className="overflow-x-auto glass-panel">
          <TransitionList machine={machine} />
        </div>
      ) : (
        <div className="drafting-grid min-h-80 overflow-auto rounded-[16px] border border-glass-line bg-surface/70 p-4">
          {status === 'loading' && <p className="text-sm text-ink-muted">{COPY.diagramLoading}</p>}
          {status === 'ok' && drawn?.status === 'ok' && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={drawn.url} alt={COPY.diagramAlt} width={drawn.width} height={drawn.height} className="max-w-none" />
          )}
          {status === 'error' && (
            <div className="flex flex-col gap-2">
              <p role="status" className="text-sm text-ink">{COPY.diagramFailed}</p>
              <TransitionList machine={machine} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
