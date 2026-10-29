'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useReducer, useState } from 'react';
import type { Decision, ProjectData } from '@/core/types';
import { createApi, type ApiResult } from '@/components/apiClient';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { COPY } from '@/components/copy';
import { DiagramView } from '@/components/DiagramView';
import { ErrorBanner } from '@/components/ErrorBanner';
import { FindingsPanel } from '@/components/FindingsPanel';
import { InputPanel } from '@/components/InputPanel';
import { LoadingText } from '@/components/LoadingText';
import { MachineEditor } from '@/components/MachineEditor';
import { ProjectFileControls, type FileMessage } from '@/components/ProjectFileControls';
import { prepareImage } from '@/components/resizeImage';
import { ResultTabs } from '@/components/ResultTabs';
import { SiteNav } from '@/components/site/SiteNav';
import { StepHeader } from '@/components/StepHeader';
import { Button } from '@/components/ui/button';
import {
  browserStorage,
  clearStoredProject,
  initialState,
  loadStoredProject,
  saveStoredProject,
  toProjectData,
  wizardReducer,
  type UploadedImage,
} from '@/components/wizardState';

type Busy = 'extract' | 'analyze' | 'finalize' | 'demo' | null;

const LOADING: Record<Exclude<Busy, null>, string | null> = {
  extract: COPY.loadingExtract,
  analyze: COPY.loadingAnalyze,
  finalize: COPY.loadingFinalize,
  demo: null,
};

export default function WizardPage() {
  const [state, dispatch] = useReducer(wizardReducer, undefined, initialState);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileMessage, setFileMessage] = useState<FileMessage | null>(null);
  const [confirmStartOver, setConfirmStartOver] = useState(false);
  const api = useMemo(() => createApi(), []);

  // Restore after mount, so the server render and the first client render match.
  useEffect(() => {
    dispatch({ type: 'storage/restored', data: loadStoredProject(browserStorage()) });
  }, []);

  // Autosave ProjectData only (never images), and only after the stored project was read.
  useEffect(() => {
    if (state.restored) saveStoredProject(browserStorage(), toProjectData(state));
  }, [state]);

  const clearMessages = () => {
    setError(null);
    setFileMessage(null);
  };

  async function run<T>(kind: Exclude<Busy, null>, call: () => Promise<ApiResult<T>>, onOk: (data: T) => void) {
    clearMessages();
    setBusy(kind);
    const r = await call();
    setBusy(null);
    if (r.ok) onOk(r.data);
    else setError(r.message);
  }

  const revokeImages = (images: UploadedImage[]) => images.forEach((i) => URL.revokeObjectURL(i.url));

  const addImages = async (files: File[]) => {
    clearMessages();
    const room = 3 - state.images.length;
    if (files.length > room) setError(COPY.imageCountError);
    const added: UploadedImage[] = [];
    for (const file of files.slice(0, Math.max(0, room))) {
      const r = await prepareImage(file);
      if (!r.ok) {
        setError(r.reason === 'size' ? COPY.errors.TOO_LARGE : COPY.imageTypeError);
        continue;
      }
      added.push({ id: crypto.randomUUID(), blob: r.blob, url: URL.createObjectURL(r.blob) });
    }
    if (added.length > 0) dispatch({ type: 'images/add', images: added });
  };

  const removeImage = (id: string) => {
    revokeImages(state.images.filter((i) => i.id === id));
    dispatch({ type: 'images/remove', id });
  };

  const loadProject = (data: ProjectData) => {
    revokeImages(state.images);
    setError(null);
    dispatch({ type: 'project/load', data });
  };

  const startOver = () => {
    setConfirmStartOver(false);
    revokeImages(state.images);
    clearStoredProject(browserStorage());
    clearMessages();
    dispatch({ type: 'reset' });
  };

  const readPlan = () =>
    run('extract', () => api.extract(state.input, state.images.map((i) => i.blob)), (d) =>
      dispatch({ type: 'extract/done', machine: d.machine, usage: d.usage }));

  const tryDemo = () =>
    run('demo', () => api.demo(), (d) => dispatch({ type: 'demo/loaded', machine: d.machine, aiFindings: d.aiFindings }));

  const findGaps = () => {
    const machine = state.machine;
    if (machine) {
      void run('analyze', () => api.analyze(machine), (d) =>
        dispatch({ type: 'analyze/done', findings: d.findings, usage: d.usage, warnings: d.warnings }));
    }
  };

  const buildSpec = () => {
    const machine = state.machine;
    if (machine) {
      void run('finalize', () => api.finalize(machine, state.findings, state.decisions), (d) => {
        const { usage, warnings: _warnings, ...result } = d;
        void _warnings;
        dispatch({ type: 'finalize/done', result, usage });
      });
    }
  };

  const decide = (decision: Decision) => dispatch({ type: 'decision/set', decision });

  return (
    <div className="site-ambient relative isolate flex min-h-svh flex-col overflow-x-clip">
      {/* Still glows (no looping motion in the wizard), matching the landing page. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-96 w-[min(1000px,130vw)] -translate-x-1/2 rounded-full bg-glow-blue/25 blur-[120px]" />
        <div className="absolute top-[45%] -right-40 h-96 w-96 rounded-full bg-glow-cyan/10 blur-[120px]" />
        <div className="absolute bottom-0 -left-40 h-96 w-96 rounded-full bg-glow-blue/15 blur-[120px]" />
      </div>
      <SiteNav />
      <div className="mx-auto flex w-full max-w-[960px] flex-col gap-6 px-4 py-8">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-mono text-xs tracking-widest text-ink-muted uppercase">{COPY.productName}</p>
          <ProjectFileControls state={state} onLoad={loadProject} onMessage={setFileMessage} />
        </header>
  
        <div aria-live="polite">
          {fileMessage?.kind === 'notice' && (
            <div className="glass-panel p-3 text-sm text-ink">
              {fileMessage.lines.map((l) => <p key={l}>{l}</p>)}
            </div>
          )}
        </div>
        {fileMessage?.kind === 'error' && <ErrorBanner message={fileMessage.lines.join(' ')} onDismiss={() => setFileMessage(null)} />}
        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
  
        <StepHeader step={state.step} />
  
        <AnimatePresence mode="wait" initial={false}>
          <motion.main
            key={state.step}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
            className="flex flex-col gap-4"
          >
            {state.step === 1 && (
              <InputPanel
                input={state.input}
                images={state.images}
                busy={busy !== null}
                onChange={(input) => dispatch({ type: 'input/set', input })}
                onAddImages={(files) => void addImages(files)}
                onRemoveImage={removeImage}
                onReadPlan={() => void readPlan()}
                onDemo={() => void tryDemo()}
              />
            )}
  
            {state.step === 2 && state.machine && (
              <>
                <div className="grid gap-4 lg:grid-cols-2">
                  <DiagramView machine={state.machine} />
                  <MachineEditor machine={state.machine} onEdit={dispatch} />
                </div>
                <div className="flex justify-end">
                  <Button type="button" disabled={busy !== null} onClick={findGaps} className="w-full sm:w-auto">{COPY.findGaps}</Button>
                </div>
            </>
          )}

          {state.step === 3 && state.machine && (
            <FindingsPanel
              machine={state.machine}
              findings={state.findings}
              decisions={state.decisions}
              aiUnavailable={state.aiUnavailable}
              busy={busy !== null}
              onDecide={decide}
              onClear={(findingId) => dispatch({ type: 'decision/clear', findingId })}
              onBuild={buildSpec}
            />
          )}

          {state.step === 4 && state.result && (
            <ResultTabs
              result={state.result}
              findings={state.findings}
              onBack={() => dispatch({ type: 'step/go', step: 3 })}
              onStartOver={() => setConfirmStartOver(true)}
            />
          )}

          <LoadingText text={busy === null ? null : LOADING[busy]} />
        </motion.main>
      </AnimatePresence>

        <ConfirmDialog open={confirmStartOver} message={COPY.startOverConfirm} onConfirm={startOver} onCancel={() => setConfirmStartOver(false)} />
      </div>
    </div>
  );
}
