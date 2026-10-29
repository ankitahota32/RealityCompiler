import { buildMatrix } from '@/core/matrix';
import { HANDLER_KINDS, type MatrixCell, type StateMachine } from '@/core/types';
import { COPY } from './copy';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';

const CELL: Record<MatrixCell, { text: string; className: string }> = {
  handled: { text: COPY.handled, className: 'text-verified' },
  missing: { text: COPY.missing, className: 'text-sev-high font-medium' },
  na: { text: COPY.notApplicable, className: 'text-ink-muted' },
};

/** Completeness table (SPEC §6.5), always computed from the machine. Symbols and words, never color alone. */
export function MatrixTable({ machine }: { machine: StateMachine }) {
  const rows = buildMatrix(machine);
  return (
    <div className="overflow-x-auto glass-panel">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{COPY.matrixState}</TableHead>
            {COPY.matrixColumns.map((c) => (
              <TableHead key={c}>{c}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.stateId}>
              <TableCell className="whitespace-normal font-medium">{r.label}</TableCell>
              {HANDLER_KINDS.map((k) => (
                <TableCell key={k} className={CELL[r[k]].className}>{CELL[r[k]].text}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
