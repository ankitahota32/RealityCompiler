'use client';

import { COPY } from './copy';
import { Button } from './ui/button';

/**
 * The one place errors are shown. `message` is already the exact SPEC §10.4 copy (see apiClient.errorMessage).
 * With `srMessage` (the rate-limit countdown) screen readers hear that fixed text once instead of every tick.
 * Without `onDismiss` the banner cannot be closed.
 */
export function ErrorBanner({ message, srMessage, onDismiss }: { message: string; srMessage?: string; onDismiss?: () => void }) {
  return (
    <div role="alert" className="flex items-start justify-between gap-3 glass-panel border-sev-high hover:border-sev-high p-3 text-ink">
      {srMessage === undefined ? (
        <p className="pt-2.5 text-sm">{message}</p>
      ) : (
        <>
          <p aria-hidden="true" className="pt-2.5 text-sm tabular-nums">{message}</p>
          <p className="sr-only">{srMessage}</p>
        </>
      )}
      {onDismiss && (
        <Button variant="ghost" size="sm" onClick={onDismiss}>
          {COPY.dismiss}
        </Button>
      )}
    </div>
  );
}
