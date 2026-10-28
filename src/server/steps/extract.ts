import { StateMachineSchema, type FlowType, type StateMachine } from '../../core/types';
import { validateMachine } from '../../core/validate';
import { addUsage, type GemmaCallOptions, type GemmaClient, type Usage } from '../gemma/client';
import { submitStateMachine } from '../gemma/declarations';
import { EXTRACT_SYSTEM_INSTRUCTION } from '../gemma/prompts';
import { AppError } from '../http';

// Step 1 (SPEC §7.2): images and text → validated state machine.

export interface ExtractInput {
  flowName: string;
  flowType: 'auto' | FlowType;
  text: string;
  images: NonNullable<GemmaCallOptions['images']>;
}
export interface ExtractResult { machine: StateMachine; usage: Usage; warnings: string[] }

export function extractUserText(input: Pick<ExtractInput, 'flowName' | 'flowType' | 'text'>): string {
  const hint = input.flowType === 'auto' ? 'none' : input.flowType;
  return `FLOW NAME: ${input.flowName}\nFLOW TYPE HINT: ${hint}\nUSER TEXT:\n${input.text.trim() === '' ? '(none)' : input.text}`;
}

export async function runExtract(input: ExtractInput, deps: { client: GemmaClient; model: string }): Promise<ExtractResult> {
  const baseText = extractUserText(input);
  const call = (userText: string) =>
    deps.client.call({
      step: 'extract',
      model: deps.model,
      systemInstruction: EXTRACT_SYSTEM_INSTRUCTION,
      images: input.images,
      userText,
      functionDeclaration: submitStateMachine,
      thinking: 'minimal',
      maxOutputTokens: 3500,
    });

  let first = await call(baseText);
  let usage = first.usage;
  let check = validateMachine(first.args);
  if (!check.ok) {
    const second = await call(
      `${baseText}\n\nYOUR PREVIOUS CALL WAS INVALID: ${check.errors.join('; ')}. Call submit_state_machine again with these problems fixed.`,
    );
    usage = addUsage(usage, second.usage);
    first = second;
    check = validateMachine(second.args);
    if (!check.ok) throw new AppError('MODEL_OUTPUT_INVALID', 'The model returned an invalid state machine twice.');
  }

  const machine = StateMachineSchema.parse(first.args);
  if (input.flowType !== 'auto') machine.flowType = input.flowType;

  const low = [...machine.states, ...machine.events, ...machine.transitions].filter((x) => x.confidence < 0.6).length;
  return { machine, usage, warnings: low > 0 ? [`LOW_CONFIDENCE:${low}`] : [] };
}
