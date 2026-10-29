import { COPY } from './copy';

/** Always visible on Step 1 (SPEC §10.1, §10.5). */
export function PrivacyNotice() {
  return (
    <div className="flex flex-col gap-1 glass-panel p-3">
      <p className="text-sm text-ink">{COPY.privacyNote}</p>
      <p className="text-sm text-ink-muted">{COPY.storageHelp}</p>
    </div>
  );
}
