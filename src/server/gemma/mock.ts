import aiGaps from '../../../fixtures/bnpl.ai-gaps.json';
import finalization from '../../../fixtures/bnpl.finalization.json';
import machine from '../../../fixtures/bnpl.machine.json';
import type { GemmaClient } from './client';

// MOCK_GEMMA=1: fixtures after 300 ms, zero usage (SPEC §7.1). Ignores the input.

export function createMockClient(delayMs = 300): GemmaClient {
  return {
    async call(o) {
      await new Promise((r) => setTimeout(r, delayMs));
      const args =
        o.step === 'extract' ? structuredClone(machine)
        : o.step === 'analyze' ? { gaps: structuredClone(aiGaps) }
        : structuredClone(finalization);
      return { args, usage: { promptTokens: 0, outputTokens: 0, totalTokens: 0 } };
    },
  };
}
