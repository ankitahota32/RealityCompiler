import { describe, expect, it } from 'vitest';
import { buildExportFiles } from '@/core/export/files';
import { bnplExportData } from './fixtures';

describe('buildExportFiles (SPEC §10.1, §11.5)', () => {
  it('returns the five files in order, none empty', () => {
    const files = buildExportFiles(bnplExportData());
    expect(files.map((f) => f.name)).toEqual([
      'spec.md',
      'scenarios.feature',
      'playwright-skeleton.spec.ts',
      'machine.json',
      'findings.json',
    ]);
    expect(files.map((f) => f.mime)).toEqual(['text/markdown', 'text/plain', 'text/plain', 'application/json', 'application/json']);
    for (const f of files) expect(f.content.trim().length).toBeGreaterThan(0);
  });

  it('spec.md holds a Mermaid block', () => {
    const spec = buildExportFiles(bnplExportData())[0]!.content;
    expect(spec).toMatch(/```mermaid\nstateDiagram-v2\n[\s\S]+?\n```/);
  });

  it('machine.json and findings.json follow §11.5 exactly', () => {
    const data = bnplExportData();
    const [, , , machine, findings] = buildExportFiles(data);
    expect(machine!.content).toBe(JSON.stringify(data.machine, null, 2));
    expect(findings!.content).toBe(
      JSON.stringify(
        {
          remaining: data.remainingFindings,
          resolvedFindingIds: data.resolvedFindingIds,
          acceptedFindingIds: data.acceptedFindingIds,
          decisions: data.decisions,
        },
        null,
        2,
      ),
    );
    expect(Object.keys(JSON.parse(findings!.content) as object)).toEqual(['remaining', 'resolvedFindingIds', 'acceptedFindingIds', 'decisions']);
  });

  it('is deterministic', () => {
    expect(buildExportFiles(bnplExportData())).toEqual(buildExportFiles(bnplExportData()));
  });
});
