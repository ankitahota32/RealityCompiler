'use client';

import { useState } from 'react';
import { runChecks } from '@/core/checker';
import { EVENT_KINDS, type EventKind, type State, type StateMachine } from '@/core/types';
import { ConfirmDialog } from './ConfirmDialog';
import { COPY, END_TYPE_LABELS, EVENT_KIND_LABELS } from './copy';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { NativeSelect } from './ui/native-select';
import { Switch } from './ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import type { MachineEdit } from './wizardState';

const LOW_CONFIDENCE = 0.6;

/** Low-confidence items show `Check this` and their evidence (SPEC §10.1 step 2). */
function CheckThis({ confidence, evidence }: { confidence: number; evidence: string }) {
  if (confidence >= LOW_CONFIDENCE) return null;
  return (
    <p className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
      <Badge variant="outline" className="border-sev-medium text-sev-medium">{COPY.checkThis}</Badge>
      <span className="font-mono text-[13px] leading-5">{evidence}</span>
    </p>
  );
}

/** A label field that commits on blur or Enter (an empty label is not applied). */
function LabelField({ id, label, ariaLabel, onCommit }: { id: string; label: string; ariaLabel: string; onCommit: (v: string) => void }) {
  return (
    <Input
      key={`${id}-${label}`}
      defaultValue={label}
      maxLength={60}
      aria-label={ariaLabel}
      onBlur={(e) => {
        if (e.target.value.trim() === '') e.target.value = label;
        else if (e.target.value !== label) onCommit(e.target.value);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
    />
  );
}

function Toggle({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex min-h-11 items-center gap-2">
      <Switch id={id} checked={checked} onCheckedChange={(v) => onChange(v)} />
      <Label htmlFor={id} className="font-normal">{label}</Label>
    </div>
  );
}

function StateRow({ s, onEdit, onDelete }: { s: State; onEdit: (a: MachineEdit) => void; onDelete: () => void }) {
  return (
    <li className="flex flex-col gap-3 glass-panel p-3">
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <LabelField id={s.id} label={s.label} ariaLabel={`${COPY.label}: ${s.label}`} onCommit={(label) => onEdit({ type: 'state/rename', id: s.id, label })} />
        </div>
        <Button type="button" variant="outline" onClick={onDelete} aria-label={`${COPY.delete} ${s.label}`}>{COPY.delete}</Button>
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
        <Toggle id={`${s.id}-start`} label={COPY.start} checked={s.initial} onChange={(value) => onEdit({ type: 'state/setStart', id: s.id, value })} />
        <div className="flex items-center gap-2">
          <Label htmlFor={`${s.id}-end`} className="font-normal">{COPY.endType}</Label>
          <NativeSelect
            id={`${s.id}-end`}
            className="w-auto"
            value={s.terminal}
            onChange={(e) => onEdit({ type: 'state/setEnd', id: s.id, terminal: e.target.value as State['terminal'] })}
          >
            {(Object.keys(END_TYPE_LABELS) as State['terminal'][]).map((t) => (
              <option key={t} value={t}>{END_TYPE_LABELS[t]}</option>
            ))}
          </NativeSelect>
        </div>
        <Toggle id={`${s.id}-ext`} label={COPY.waitsForOutside} checked={s.awaitsExternal} onChange={(value) => onEdit({ type: 'state/setFlag', id: s.id, flag: 'awaitsExternal', value })} />
        <Toggle id={`${s.id}-input`} label={COPY.needsUserInput} checked={s.userInput} onChange={(value) => onEdit({ type: 'state/setFlag', id: s.id, flag: 'userInput', value })} />
      </div>
      <CheckThis confidence={s.confidence} evidence={s.evidence} />
    </li>
  );
}

function KindSelect({ id, value, onChange, label }: { id: string; value: EventKind; onChange: (k: EventKind) => void; label?: string }) {
  return (
    <NativeSelect id={id} aria-label={label} value={value} onChange={(e) => onChange(e.target.value as EventKind)}>
      {EVENT_KINDS.map((k) => (
        <option key={k} value={k}>{EVENT_KIND_LABELS[k]}</option>
      ))}
    </NativeSelect>
  );
}

/** Step 2 editor: States, Events, Transitions tabs plus the live structural-issue count. */
export function MachineEditor({ machine, onEdit }: { machine: StateMachine; onEdit: (a: MachineEdit) => void }) {
  const [tab, setTab] = useState<'states' | 'events' | 'transitions'>('states');
  const [pendingDelete, setPendingDelete] = useState<{ kind: 'state' | 'event'; id: string } | null>(null);
  const [newState, setNewState] = useState('');
  const [newEvent, setNewEvent] = useState('');
  const [newEventKind, setNewEventKind] = useState<EventKind>('user_action');
  const [from, setFrom] = useState('');
  const [via, setVia] = useState('');
  const [to, setTo] = useState('');

  const issues = runChecks(machine).length;
  const stateLabel = (id: string) => machine.states.find((s) => s.id === id)?.label ?? id;
  const eventLabel = (id: string) => machine.events.find((e) => e.id === id)?.label ?? id;
  const firstState = machine.states[0]?.id ?? '';
  const firstEvent = machine.events[0]?.id ?? '';
  const pick = (value: string, ids: string[], fallback: string) => (ids.includes(value) ? value : fallback);
  const stateIds = machine.states.map((s) => s.id);
  const fromId = pick(from, stateIds, firstState);
  const toId = pick(to, stateIds, firstState);
  const eventId = pick(via, machine.events.map((e) => e.id), firstEvent);

  return (
    <div className="flex flex-col gap-3">
      <p aria-live="polite" className="text-sm font-medium text-ink">{COPY.structuralIssues(issues)}</p>
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList className="w-full">
          <TabsTrigger value="states">{COPY.statesTab}</TabsTrigger>
          <TabsTrigger value="events">{COPY.eventsTab}</TabsTrigger>
          <TabsTrigger value="transitions">{COPY.transitionsTab}</TabsTrigger>
        </TabsList>

        <TabsContent value="states" className="flex flex-col gap-3 pt-2">
          <ul className="flex flex-col gap-3">
            {machine.states.map((s) => (
              <StateRow key={s.id} s={s} onEdit={onEdit} onDelete={() => setPendingDelete({ kind: 'state', id: s.id })} />
            ))}
          </ul>
          <form
            className="flex flex-col gap-2 sm:flex-row sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              onEdit({ type: 'state/add', label: newState });
              setNewState('');
            }}
          >
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="new-state">{COPY.label}</Label>
              <Input id="new-state" maxLength={60} value={newState} onChange={(e) => setNewState(e.target.value)} />
            </div>
            <Button type="submit" variant="outline" disabled={newState.trim() === '' || machine.states.length >= 25}>{COPY.addState}</Button>
          </form>
        </TabsContent>

        <TabsContent value="events" className="flex flex-col gap-3 pt-2">
          <ul className="flex flex-col gap-3">
            {machine.events.map((ev) => (
              <li key={ev.id} className="flex flex-col gap-3 glass-panel p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="flex-1">
                    <LabelField id={ev.id} label={ev.label} ariaLabel={`${COPY.label}: ${ev.label}`} onCommit={(label) => onEdit({ type: 'event/rename', id: ev.id, label })} />
                  </div>
                  <div className="sm:w-48">
                    <KindSelect id={`${ev.id}-kind`} label={`${COPY.kind}: ${ev.label}`} value={ev.kind} onChange={(kind) => onEdit({ type: 'event/setKind', id: ev.id, kind })} />
                  </div>
                  <Button type="button" variant="outline" onClick={() => setPendingDelete({ kind: 'event', id: ev.id })} aria-label={`${COPY.delete} ${ev.label}`}>
                    {COPY.delete}
                  </Button>
                </div>
                <CheckThis confidence={ev.confidence} evidence={ev.evidence} />
              </li>
            ))}
          </ul>
          <form
            className="flex flex-col gap-2 sm:flex-row sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              onEdit({ type: 'event/add', label: newEvent, kind: newEventKind });
              setNewEvent('');
            }}
          >
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="new-event">{COPY.label}</Label>
              <Input id="new-event" maxLength={60} value={newEvent} onChange={(e) => setNewEvent(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2 sm:w-48">
              <Label htmlFor="new-event-kind">{COPY.kind}</Label>
              <KindSelect id="new-event-kind" value={newEventKind} onChange={setNewEventKind} />
            </div>
            <Button type="submit" variant="outline" disabled={newEvent.trim() === '' || machine.events.length >= 40}>{COPY.addEvent}</Button>
          </form>
        </TabsContent>

        <TabsContent value="transitions" className="flex flex-col gap-3 pt-2">
          <ul className="flex flex-col gap-2">
            {machine.transitions.map((t) => (
              <li key={t.id} className="flex flex-col gap-2 glass-panel p-3">
                <div className="flex items-center gap-2">
                  <p className="flex-1 text-sm text-ink">
                    {stateLabel(t.from)} <span className="text-ink-muted">·</span> {eventLabel(t.event)} <span className="text-ink-muted">·</span> {stateLabel(t.to)}
                  </p>
                  <Button type="button" variant="outline" onClick={() => onEdit({ type: 'transition/delete', id: t.id })} aria-label={`${COPY.delete}: ${stateLabel(t.from)} ${eventLabel(t.event)} ${stateLabel(t.to)}`}>
                    {COPY.delete}
                  </Button>
                </div>
                <CheckThis confidence={t.confidence} evidence={t.evidence} />
              </li>
            ))}
          </ul>
          <form
            className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              onEdit({ type: 'transition/add', from: fromId, event: eventId, to: toId });
            }}
          >
            {([['add-from', COPY.from, fromId, setFrom, machine.states], ['add-event', COPY.event, eventId, setVia, machine.events], ['add-to', COPY.to, toId, setTo, machine.states]] as const).map(
              ([id, label, value, set, items]) => (
                <div key={id} className="flex flex-col gap-2">
                  <Label htmlFor={id}>{label}</Label>
                  <NativeSelect id={id} value={value} onChange={(e) => set(e.target.value)}>
                    {items.map((item) => (
                      <option key={item.id} value={item.id}>{item.label}</option>
                    ))}
                  </NativeSelect>
                </div>
              ),
            )}
            <Button type="submit" variant="outline" disabled={!fromId || !eventId || !toId || machine.transitions.length >= 60}>
              {COPY.addTransition}
            </Button>
          </form>
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={pendingDelete !== null}
        message={pendingDelete?.kind === 'event' ? COPY.deleteEventConfirm : COPY.deleteStateConfirm}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) onEdit({ type: pendingDelete.kind === 'state' ? 'state/delete' : 'event/delete', id: pendingDelete.id });
          setPendingDelete(null);
        }}
      />
    </div>
  );
}
