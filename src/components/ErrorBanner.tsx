'use client';

import { COPY } from './copy';
import { Button } from './ui/button';

/** The one place errors are shown. `message` is already the exact SPEC §10.4 copy (see apiClient.errorMessage). */
export function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div role="alert" className="flex items-start justify-between gap-3 glass-panel border-sev-high hover:border-sev-high p-3 text-ink">
      <p className="pt-2.5 text-sm">{message}</p>
      <Button variant="ghost" size="sm" onClick={onDismiss}>
        {COPY.dismiss}
      </Button>
    </div>
  );
}
