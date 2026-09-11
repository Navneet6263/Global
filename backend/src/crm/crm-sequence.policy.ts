import { BadRequestException } from "@nestjs/common";
export const CRM_SEQUENCE_HOURS = [24, 72, 168] as const;
export function sequenceAfterCompletion(
  start: Date | null,
  step: number | null,
) {
  if (!start || step === null) return { nextFollowUpAt: null };
  if (!Number.isInteger(step) || step < 0 || step > 2)
    throw new BadRequestException("Follow-up sequence has already ended");
  const nextStep = step + 1;
  return {
    followUpSequenceStep: nextStep,
    nextFollowUpAt:
      nextStep < 3
        ? new Date(start.getTime() + CRM_SEQUENCE_HOURS[nextStep]! * 3_600_000)
        : null,
  };
}
