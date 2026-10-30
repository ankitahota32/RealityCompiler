'use client';

import { BookOpen } from 'lucide-react';
import { useState } from 'react';
import type { ExportData } from '@/core/types';
import { FILE_GUIDES, GUIDE_COPY, GUIDE_ORDER, guideSummary, type GuideLine } from './guideContent';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from './ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

function Line({ line }: { line: GuideLine }) {
  if (typeof line === 'string') return <>{line}</>;
  return (
    <>
      {line.text}{' '}
      <code className="rounded-sm border border-glass-line bg-white/[0.06] px-1.5 py-0.5 font-mono text-[13px] break-all text-ink">{line.code}</code>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5">
      <h4 className="font-mono text-xs tracking-wider text-[#A9C3FF] uppercase">{title}</h4>
      {children}
    </section>
  );
}

/** Export tab helper: explains what each download is for, where it goes and how to use it. */
export function ExportGuide({ data }: { data: Omit<ExportData, 'generatedAt'> }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)} className="w-full sm:w-auto">
        <BookOpen aria-hidden="true" />
        {GUIDE_COPY.button}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="glass-panel flex max-h-[88vh] flex-col gap-4 overflow-hidden bg-[#0B0F1E]/95 p-5 sm:max-w-2xl">
          <div className="flex flex-col gap-1 pr-8">
            <DialogTitle className="text-xl font-[450] tracking-[-0.02em] text-ink">{GUIDE_COPY.title}</DialogTitle>
            <DialogDescription className="text-sm text-ink-muted">{GUIDE_COPY.intro}</DialogDescription>
          </div>

          <Tabs defaultValue="start" className="flex min-h-0 flex-1 flex-col">
            <div className="shrink-0 overflow-x-auto">
              <TabsList>
                <TabsTrigger value="start">{GUIDE_COPY.startTab}</TabsTrigger>
                {FILE_GUIDES.map((g) => (
                  <TabsTrigger key={g.file} value={g.file} className="font-mono text-xs">{g.file}</TabsTrigger>
                ))}
              </TabsList>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto pt-3 pr-1">
              <TabsContent value="start" className="flex flex-col gap-4">
                <Section title={GUIDE_COPY.yourResult}>
                  {guideSummary(data).map((l) => <p key={l} className="text-[15px] leading-6 text-ink">{l}</p>)}
                </Section>
                <Section title={GUIDE_COPY.order}>
                  <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-[15px] leading-6 text-ink marker:text-ink-muted">
                    {GUIDE_ORDER.map((l) => <li key={l}>{l}</li>)}
                  </ol>
                </Section>
              </TabsContent>

              {FILE_GUIDES.map((g) => (
                <TabsContent key={g.file} value={g.file} className="flex flex-col gap-4">
                  <Section title={GUIDE_COPY.what}>
                    <p className="text-[15px] leading-6 text-ink">{g.what}</p>
                  </Section>
                  <Section title={GUIDE_COPY.who}>
                    <p className="text-[15px] leading-6 text-ink">{g.who}</p>
                  </Section>
                  <Section title={GUIDE_COPY.where}>
                    <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[15px] leading-6 text-ink marker:text-ink-muted">
                      {g.where.map((l, i) => <li key={i}><Line line={l} /></li>)}
                    </ul>
                  </Section>
                  <Section title={GUIDE_COPY.how}>
                    <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-[15px] leading-6 text-ink marker:text-ink-muted">
                      {g.how.map((l, i) => <li key={i}><Line line={l} /></li>)}
                    </ol>
                  </Section>
                </TabsContent>
              ))}
            </div>
          </Tabs>

          <DialogFooter className="shrink-0">
            <Button type="button" onClick={() => setOpen(false)}>{GUIDE_COPY.close}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
