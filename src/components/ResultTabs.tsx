'use client';

import { useState } from 'react';
import { orderScenarios } from '@/core/scenarios';
import type { Finding, ProjectResult, Scenario } from '@/core/types';
import { COPY } from './copy';
import { DiagramView } from './DiagramView';
import { SeverityBadge, SourceBadge } from './FindingCard';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

type Tab = 'map' | 'rules' | 'scenarios' | 'issues' | 'export';

function ScenarioItem({ s }: { s: Scenario }) {
  return (
    <li className="flex flex-col gap-2 glass-panel p-3">
      <div className="flex flex-wrap items-center gap-2">
        <SeverityBadge severity={s.priority} />
        <h4 className="text-base font-medium text-ink">{s.title}</h4>
      </div>
      <ol className="flex flex-col gap-1 text-sm text-ink">
        {s.steps.map((step, i) => (
          <li key={i}><span className="font-semibold">{step.keyword}</span> {step.text}</li>
        ))}
      </ol>
    </li>
  );
}

function IssueItem({ f, label }: { f: Finding; label?: string }) {
  return (
    <li className="flex flex-col gap-2 glass-panel p-3">
      <div className="flex flex-wrap gap-2">
        <SeverityBadge severity={f.severity} />
        <SourceBadge source={f.source} />
        {label && <Badge variant="outline" className="border-line text-ink">{label}</Badge>}
      </div>
      <h4 className="text-base font-medium text-ink">{f.title}</h4>
      <p className="max-w-[70ch] text-sm text-ink-muted">{f.question.text}</p>
    </li>
  );
}

/** Step 4: Map, Rules, Scenarios (decision first), Open issues, Export. */
export function ResultTabs({
  result,
  findings,
  onBack,
  onStartOver,
}: {
  result: ProjectResult;
  findings: Finding[];
  onBack: () => void;
  onStartOver: () => void;
}) {
  const [tab, setTab] = useState<Tab>('map');
  const accepted = new Set(result.acceptedFindingIds);
  const resolved = new Set(result.resolvedFindingIds);
  const aiResolved = findings.filter((f) => f.source === 'ai' && resolved.has(f.id));
  const scenarios = orderScenarios(result.scenarios, result.machine);

  return (
    <div className="flex flex-col gap-4">
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <div className="overflow-x-auto">
          <TabsList>
            <TabsTrigger value="map">{COPY.mapTab}</TabsTrigger>
            <TabsTrigger value="rules">{COPY.rulesTab}</TabsTrigger>
            <TabsTrigger value="scenarios">{COPY.scenariosTab}</TabsTrigger>
            <TabsTrigger value="issues">{COPY.openIssuesTab}</TabsTrigger>
            <TabsTrigger value="export">{COPY.exportTab}</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="map" className="pt-2">
          <DiagramView machine={result.machine} />
        </TabsContent>

        <TabsContent value="rules" className="pt-2">
          {result.rules.length === 0 ? (
            <p className="text-sm text-ink-muted">{COPY.noRules}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {result.rules.map((r) => (
                <li key={r.id} className="flex gap-3 glass-panel p-3 text-base text-ink">
                  <span className="font-mono text-[13px] leading-6 text-ink-muted">{r.id}</span>
                  <span className="max-w-[70ch]">{r.text}</span>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="scenarios" className="flex flex-col gap-4 pt-2">
          {(['decision', 'transition'] as const).map((origin) => {
            const list = scenarios.filter((s) => s.origin === origin);
            return (
              <section key={origin} className="flex flex-col gap-2">
                <h3 className="text-xl font-semibold text-ink">{origin === 'decision' ? COPY.fromDecisions : COPY.perTransition}</h3>
                <ul className="flex flex-col gap-2">
                  {list.map((s) => <ScenarioItem key={s.id} s={s} />)}
                </ul>
              </section>
            );
          })}
        </TabsContent>

        <TabsContent value="issues" className="pt-2">
          {result.remainingFindings.length + aiResolved.length === 0 ? (
            <p className="text-sm text-ink-muted">{COPY.noIssues}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {result.remainingFindings.map((f) => (
                <IssueItem key={f.id} f={f} label={accepted.has(f.id) ? COPY.acceptedAsIs : undefined} />
              ))}
              {aiResolved.map((f) => <IssueItem key={f.id} f={f} label={COPY.resolvedByAnswer} />)}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="export" className="pt-2">
          <p className="text-sm text-ink-muted">{COPY.exportsLater}</p>
        </TabsContent>
      </Tabs>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onStartOver} className="w-full sm:w-auto">{COPY.startOver}</Button>
        <Button type="button" variant="outline" onClick={onBack} className="w-full sm:w-auto">{COPY.backToGaps}</Button>
      </div>
    </div>
  );
}
