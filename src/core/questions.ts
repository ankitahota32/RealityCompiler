import type { CheckerRule, HandlerKind, Question, StateMachine } from './types';

// Templated questions for checker findings (SPEC §6.4). Zero model tokens; wording is exact.

export type QuestionInput =
  | { rule: 'NO_INITIAL' | 'MULTIPLE_INITIAL' | 'NO_SUCCESS_TERMINAL' | 'NO_FAILURE_TERMINAL' }
  | { rule: 'UNREACHABLE_STATE' | 'DEAD_END_STATE' | 'NO_PATH_TO_TERMINAL' | 'TERMINAL_HAS_OUTGOING'; stateId: string }
  | { rule: 'NONDETERMINISTIC'; stateId: string; eventId: string; targetIds: string[] }
  | { rule: 'MISSING_HANDLER'; stateId: string; kind: HandlerKind };

// Compile-time check that every checker rule has a question.
type Covered = QuestionInput['rule'];
const _allRulesCovered: [CheckerRule] extends [Covered] ? true : never = true;
void _allRulesCovered;

const NOT_SURE = 'Not sure yet';

function finish(text: string, options: string[]): Question {
  const trimmed = options.map((o) => o.slice(0, 80));
  while (trimmed.length < 2) trimmed.push(NOT_SURE);
  return { text: text.slice(0, 200), options: trimmed.slice(0, 4) };
}

export function buildQuestion(input: QuestionInput, machine: StateMachine): Question {
  const stateLabel = (id: string) => machine.states.find((s) => s.id === id)?.label ?? id;
  const initials = machine.states.filter((s) => s.initial);
  const initial = initials.length === 1 && initials[0] !== undefined ? initials[0].label : 'the start';

  switch (input.rule) {
    case 'MISSING_HANDLER': {
      const state = stateLabel(input.stateId);
      switch (input.kind) {
        case 'timeout':
          return finish(`What should happen if "${state}" gets no answer in time?`, [
            'Retry automatically, then show an error',
            'Show an error and let the user retry',
            `Cancel and go back to ${initial}`,
            'Keep waiting and check again later',
          ]);
        case 'failure':
          return finish(
            `What should happen if something goes wrong while "${state}" is waiting (for example a service error)?`,
            ['Show an error and let the user retry', 'Retry automatically up to 3 times', `Cancel and go back to ${initial}`],
          );
        case 'cancel':
          return finish(`Can the user cancel or go back from "${state}"?`, [
            'Yes, go back to the previous step',
            `Yes, cancel everything and return to ${initial}`,
            'No, cancelling is not allowed here',
          ]);
        case 'duplicate':
          return finish(`What should happen if the user submits "${state}" twice (double tap)?`, [
            'Ignore the second submit',
            'Show a loading state until the first finishes',
            'Show a warning message',
          ]);
      }
      break;
    }
    case 'DEAD_END_STATE':
      return finish(`After "${stateLabel(input.stateId)}", where should the user go next?`, [
        `Back to ${initial}`,
        'Back to the previous step',
        'Show a final failure screen (end of flow)',
      ]);
    case 'NO_PATH_TO_TERMINAL':
      return finish(`"${stateLabel(input.stateId)}" can never reach an end. How should this flow finish from here?`, [
        'Finish successfully',
        'Show a final failure screen (end of flow)',
        `Go back to ${initial}`,
      ]);
    case 'UNREACHABLE_STATE':
      return finish(`Nothing leads to "${stateLabel(input.stateId)}". What should we do?`, [
        'It is reached from another step (describe it)',
        'It is not part of this flow',
      ]);
    case 'TERMINAL_HAS_OUTGOING':
      return finish(`"${stateLabel(input.stateId)}" is an end state but has moves leaving it. Which is correct?`, [
        'It is really an end state',
        'It is not an end state',
      ]);
    case 'NONDETERMINISTIC': {
      const event = machine.events.find((e) => e.id === input.eventId)?.label ?? input.eventId;
      return finish(`When "${event}" happens in "${stateLabel(input.stateId)}", which outcome is correct?`, [
        ...input.targetIds.slice(0, 3).map(stateLabel),
        'It depends on a condition (describe it)',
      ]);
    }
    case 'NO_SUCCESS_TERMINAL': {
      const candidates = machine.states
        .filter((s) => s.terminal === 'none' && !machine.transitions.some((t) => t.from === s.id))
        .slice(0, 2)
        .map((s) => s.label);
      return finish('Which state means the flow finished successfully?', [
        ...candidates,
        'A new success end state is needed',
        NOT_SURE,
      ]);
    }
    case 'NO_FAILURE_TERMINAL':
      return finish('Does this flow have a final failure outcome (for example "Payment Failed")?', [
        'Yes, add a final failure screen',
        `No, failures always return to ${initial}`,
      ]);
    case 'NO_INITIAL':
      return finish('Which state is where the flow starts?', [
        ...machine.states.slice(0, 3).map((s) => s.label),
        'Another step (describe it)',
      ]);
    case 'MULTIPLE_INITIAL':
      return finish(
        'More than one state is marked as the start. Which one is the real start?',
        initials.slice(0, 4).map((s) => s.label),
      );
  }
  // Unreachable: every rule returns above. Kept so the function always returns a valid question.
  return finish('What should happen here?', [NOT_SURE]);
}
