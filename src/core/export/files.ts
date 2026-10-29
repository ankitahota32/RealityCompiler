import type { ExportData } from '../types';
import { toGherkin } from './gherkin';
import { toPlaywright } from './playwright';
import { toSpecMarkdown } from './spec';

export interface ExportFile {
  name: string;
  mime: string;
  content: string;
}

/** The five downloads of the Export tab, in SPEC §10.1 order. */
export function buildExportFiles(data: ExportData): ExportFile[] {
  return [
    { name: 'spec.md', mime: 'text/markdown', content: toSpecMarkdown(data) },
    { name: 'scenarios.feature', mime: 'text/plain', content: toGherkin(data) },
    { name: 'playwright-skeleton.spec.ts', mime: 'text/plain', content: toPlaywright(data) },
    { name: 'machine.json', mime: 'application/json', content: JSON.stringify(data.machine, null, 2) },
    {
      name: 'findings.json',
      mime: 'application/json',
      // SPEC §11.5 names the first key `remaining`.
      content: JSON.stringify(
        {
          remaining: data.remainingFindings,
          resolvedFindingIds: data.resolvedFindingIds,
          acceptedFindingIds: data.acceptedFindingIds,
          decisions: data.decisions,
        },
        null,
        2,
      ),
    },
  ];
}
