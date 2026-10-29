'use client';

import { useRef, useState } from 'react';
import { PROJECT_FILE_MAX_BYTES, parseProjectFile, projectFileName, serializeProject } from '@/core/project';
import type { ProjectData } from '@/core/types';
import { ConfirmDialog } from './ConfirmDialog';
import { COPY } from './copy';
import { Button } from './ui/button';
import { canSave, hasContent, toProjectData, type WizardState } from './wizardState';

/** Messages shown after a save or open: a notice plus warning lines, or an error. */
export type FileMessage = { kind: 'notice'; lines: string[] } | { kind: 'error'; lines: string[] };

function warningLine(w: string): string | null {
  if (w === 'STEP_REDUCED') return COPY.stepReduced;
  const dropped = /^DECISIONS_DROPPED:(\d+)$/.exec(w);
  return dropped?.[1] ? COPY.decisionsDropped(Number(dropped[1])) : null;
}

/** Save and open a project file. Pure client code: no API route, no network (SPEC §10.5). */
export function ProjectFileControls({
  state,
  onLoad,
  onMessage,
}: {
  state: WizardState;
  onLoad: (data: ProjectData) => void;
  onMessage: (m: FileMessage) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const save = () => {
    const text = serializeProject(toProjectData(state), new Date().toISOString());
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = projectFileName(state.machine?.name ?? state.input.flowName);
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    onMessage({ kind: 'notice', lines: [COPY.projectDownloaded] });
  };

  const open = async (file: File) => {
    const parsed = parseProjectFile(await file.text());
    if (!parsed.ok) {
      onMessage({ kind: 'error', lines: [COPY.parseErrors[parsed.code]] });
      return;
    }
    onLoad(parsed.data);
    onMessage({
      kind: 'notice',
      lines: [COPY.projectLoaded, ...parsed.warnings.map(warningLine).filter((l): l is string => l !== null)],
    });
  };

  const choose = (file: File | undefined) => {
    if (!file) return;
    if (file.size > PROJECT_FILE_MAX_BYTES) {
      onMessage({ kind: 'error', lines: [COPY.parseErrors.TOO_LARGE] });
      return;
    }
    if (hasContent(state)) setPendingFile(file);
    else void open(file);
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" size="sm" className="h-11 sm:h-9" disabled={!canSave(state)} onClick={save}>
        {COPY.saveProject}
      </Button>
      <Button type="button" variant="outline" size="sm" className="h-11 sm:h-9" onClick={() => inputRef.current?.click()}>
        {COPY.openProject}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(e) => {
          choose(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <ConfirmDialog
        open={pendingFile !== null}
        message={COPY.replaceConfirm}
        onCancel={() => setPendingFile(null)}
        onConfirm={() => {
          const file = pendingFile;
          setPendingFile(null);
          if (file) void open(file);
        }}
      />
    </div>
  );
}
