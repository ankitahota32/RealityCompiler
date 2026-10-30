import { describe, expect, it } from 'vitest';
import { buildExportFiles } from '@/core/export/files';
import { FILE_GUIDES, guideSummary } from '@/components/guideContent';
import { bnplExportData } from '../core/fixtures';

describe('export guide', () => {
  it('covers exactly the five export files, in the same order', () => {
    const files = buildExportFiles(bnplExportData()).map((f) => f.name);
    expect(FILE_GUIDES.map((g) => g.file)).toEqual(files);
    for (const g of FILE_GUIDES) {
      expect(g.where.length).toBeGreaterThan(0);
      expect(g.how.length).toBeGreaterThan(0);
    }
  });

  it('summarizes the result with counts and the open issues', () => {
    const data = bnplExportData();
    const [first, second] = guideSummary(data);
    expect(first).toContain(`${data.machine.states.length} states`);
    expect(first).toContain(`${data.machine.transitions.length} transitions`);
    expect(first).toContain(`${data.scenarios.length} test scenarios`);
    const accepted = new Set(data.acceptedFindingIds);
    const open = data.remainingFindings.filter((f) => !accepted.has(f.id));
    expect(open.length).toBeGreaterThan(0);
    expect(second).toContain(`${open.length} issues are still open`);
  });

  it('says the spec is ready when nothing is open, and uses singular words for one', () => {
    const data = bnplExportData();
    const lines = guideSummary({
      ...data,
      machine: { ...data.machine, transitions: data.machine.transitions.slice(0, 1) },
      rules: data.rules.slice(0, 1),
      remainingFindings: [],
    });
    expect(lines[0]).toContain('1 transition,');
    expect(lines[0]).toContain('1 rule ');
    expect(lines[1]).toBe('No issues are left open, so the spec is ready to share and build from.');
  });
});
