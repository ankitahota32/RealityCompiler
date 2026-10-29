'use client';

import { Check, Copy, Download } from 'lucide-react';
import { useMemo, useState } from 'react';
import { buildExportFiles } from '@/core/export/files';
import type { ExportData } from '@/core/types';
import { COPY } from './copy';
import { downloadText } from './download';
import { Button } from './ui/button';

type CopyState = { name: string; ok: boolean } | null;

/** Local date as YYYY-MM-DD (SPEC §11: generatedAt). */
function today(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Step 4 Export tab: a Download and a Copy button for each of the five files (SPEC §10.1). */
export function ExportPanel({ data }: { data: Omit<ExportData, 'generatedAt'> }) {
  const files = useMemo(() => buildExportFiles({ ...data, generatedAt: today() }), [data]);
  const [copied, setCopied] = useState<CopyState>(null);

  const copy = async (name: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied({ name, ok: true });
    } catch {
      setCopied({ name, ok: false });
    }
    setTimeout(() => setCopied((c) => (c?.name === name ? null : c)), 2500);
  };

  return (
    <ul className="flex flex-col gap-2">
      {files.map((f) => {
        const state = copied?.name === f.name ? copied : null;
        return (
          <li key={f.name} className="glass-panel flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="font-mono text-[13px] leading-5 break-all text-ink">{f.name}</span>
              <span aria-live="polite" className="text-sm text-ink-muted">
                {state ? (state.ok ? COPY.copied : COPY.copyFailed) : null}
              </span>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button
                type="button"
                variant="outline"
                aria-label={COPY.copyLabel(f.name)}
                onClick={() => void copy(f.name, f.content)}
                className="flex-1 sm:flex-none"
              >
                {state?.ok ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                {COPY.copy}
              </Button>
              <Button
                type="button"
                aria-label={COPY.downloadLabel(f.name)}
                onClick={() => downloadText(f.name, f.content, f.mime)}
                className="flex-1 sm:flex-none"
              >
                <Download aria-hidden="true" />
                {COPY.download}
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
