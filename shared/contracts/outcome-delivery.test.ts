import { describe, expect, it } from 'vitest';
import {
  OutputDraftInputSchema,
  SubmitOutputInputSchema,
} from './outcome-delivery';
describe('Output contracts', () => {
  it('requires actual submission content and an idempotency key', () => {
    expect(
      SubmitOutputInputSchema.safeParse({
        content: ' ',
        requestId: crypto.randomUUID(),
      }).success,
    ).toBe(false);
    expect(
      SubmitOutputInputSchema.safeParse({ content: 'Result' }).success,
    ).toBe(false);
    expect(
      SubmitOutputInputSchema.parse({
        content: ' Result ',
        requestId: crypto.randomUUID(),
      }).content,
    ).toBe('Result');
  });
  it('permits empty drafts but bounds output content and denies forged submitter fields', () => {
    expect(OutputDraftInputSchema.safeParse({ content: '' }).success).toBe(
      true,
    );
    expect(
      OutputDraftInputSchema.safeParse({ content: 'a'.repeat(10001) }).success,
    ).toBe(false);
    expect(
      SubmitOutputInputSchema.safeParse({
        content: 'Result',
        requestId: crypto.randomUUID(),
        submittedByMemberId: crypto.randomUUID(),
      }).success,
    ).toBe(false);
  });
});
