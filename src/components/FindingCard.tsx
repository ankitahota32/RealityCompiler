'use client';

import type { Decision, Finding, Severity } from '@/core/types';
import { COPY } from './copy';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Textarea } from './ui/textarea';

const SEVERITY_CLASS: Record<Severity, string> = {
  high: 'border-sev-high text-sev-high',
  medium: 'border-sev-medium text-sev-medium',
  low: 'border-sev-low text-sev-low',
};

/** HIGH / MEDIUM / LOW as text plus color (SPEC §10). */
export function SeverityBadge({ severity }: { severity: Severity }) {
  return <Badge variant="outline" className={`font-semibold ${SEVERITY_CLASS[severity]}`}>{severity.toUpperCase()}</Badge>;
}

/** Source badges differ in text and color (design.md §3). */
export function SourceBadge({ source }: { source: Finding['source'] }) {
  return source === 'checker'
    ? <Badge variant="outline" className="border-verified text-verified">{COPY.checkedByCode}</Badge>
    : <Badge variant="outline" className="border-ai text-ai">{COPY.suggestedByAi}</Badge>;
}

/** One finding with its question. Every string from the model is rendered as plain text. */
export function FindingCard({
  finding,
  stateLabels,
  decision,
  onDecide,
  onClear,
}: {
  finding: Finding;
  stateLabels: string[];
  decision: Decision | undefined;
  onDecide: (d: Decision) => void;
  onClear: () => void;
}) {
  const id = finding.id;
  const optionValue = decision?.answerType === 'option' ? decision.answer : '';
  const customValue = decision?.answerType === 'custom' ? decision.answer : '';
  const pressed = (t: Decision['answerType']) => decision?.answerType === t;

  return (
    <article className="glass-panel flex flex-col gap-3 p-4 transition-transform duration-200 hover:-translate-y-0.5" aria-labelledby={`${id}-title`}>
      <div className="flex flex-wrap gap-2">
        <SeverityBadge severity={finding.severity} />
        <SourceBadge source={finding.source} />
      </div>
      <h3 id={`${id}-title`} className="text-base font-semibold text-ink">{finding.title}</h3>
      <p className="max-w-[70ch] text-base text-ink">{finding.description}</p>
      {stateLabels.length > 0 && (
        <p className="text-sm text-ink-muted">{COPY.states}: {stateLabels.join(', ')}</p>
      )}
      {finding.source === 'ai' && <p className="text-sm text-ai">{COPY.aiNote}</p>}

      <div className="flex flex-col gap-3 border-t border-line pt-3">
        <p id={`${id}-q`} className="max-w-[70ch] text-base font-medium text-ink">{finding.question.text}</p>
        <RadioGroup
          aria-labelledby={`${id}-q`}
          value={optionValue}
          onValueChange={(value) => onDecide({ findingId: id, answerType: 'option', answer: String(value) })}
        >
          {finding.question.options.map((option, i) => (
            <div key={`${i}-${option}`} className="flex min-h-11 items-center gap-3">
              <RadioGroupItem id={`${id}-o${i}`} value={option} />
              <Label htmlFor={`${id}-o${i}`} className="font-normal">{option}</Label>
            </div>
          ))}
        </RadioGroup>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-custom`}>{COPY.writeOwnAnswer}</Label>
          <Textarea
            id={`${id}-custom`}
            rows={2}
            maxLength={400}
            value={customValue}
            onChange={(e) =>
              e.target.value.trim() === ''
                ? onClear()
                : onDecide({ findingId: id, answerType: 'custom', answer: e.target.value })
            }
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={pressed('accepted') ? 'default' : 'outline'}
            aria-pressed={pressed('accepted')}
            onClick={() => onDecide({ findingId: id, answerType: 'accepted', answer: '' })}
          >
            {COPY.acceptAsIs}
          </Button>
          <Button
            type="button"
            variant={pressed('skip') ? 'default' : 'outline'}
            aria-pressed={pressed('skip')}
            onClick={() => onDecide({ findingId: id, answerType: 'skip', answer: '' })}
          >
            {COPY.decideLater}
          </Button>
        </div>
      </div>
    </article>
  );
}
