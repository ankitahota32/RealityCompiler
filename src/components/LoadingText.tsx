/** The exact loading line of SPEC §10.2, announced politely, with a quiet opacity shimmer. */
export function LoadingText({ text }: { text: string | null }) {
  return (
    <p aria-live="polite" className="min-h-6 text-sm text-ink-muted">
      {text === null ? null : <span className="loading-shimmer">{text}</span>}
    </p>
  );
}
