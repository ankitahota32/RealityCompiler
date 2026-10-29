import { COPY } from './copy';

/** The exact loading line of SPEC §10.2, announced politely, with a quiet opacity shimmer; after 10 s a second line. */
export function LoadingText({ text, stillWorking = false }: { text: string | null; stillWorking?: boolean }) {
  return (
    <div aria-live="polite" className="flex min-h-6 flex-col gap-1 text-sm text-ink-muted">
      {text === null ? null : <p className="loading-shimmer">{text}</p>}
      {text !== null && stillWorking && <p>{COPY.stillWorking}</p>}
    </div>
  );
}
