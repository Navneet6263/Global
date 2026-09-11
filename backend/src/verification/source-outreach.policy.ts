import { BadRequestException } from "@nestjs/common";

export function outreachDates(
  input: { occurredAt: string; nextFollowUpAt?: string; notes: string },
  requestedAt: Date,
  now = new Date(),
) {
  const occurredAt = new Date(input.occurredAt);
  const nextFollowUpAt = input.nextFollowUpAt
    ? new Date(input.nextFollowUpAt)
    : null;
  if (
    !Number.isFinite(occurredAt.getTime()) ||
    occurredAt > now ||
    occurredAt < requestedAt
  )
    throw new BadRequestException(
      "Contact time must be between the source request and now",
    );
  if (
    nextFollowUpAt &&
    (!Number.isFinite(nextFollowUpAt.getTime()) ||
      nextFollowUpAt <= now ||
      nextFollowUpAt.getTime() > now.getTime() + 90 * 86_400_000)
  )
    throw new BadRequestException("Next follow-up must be in the next 90 days");
  if (input.notes.trim().length < 10)
    throw new BadRequestException(
      "Record what was actually discussed or attempted",
    );
  return { occurredAt, nextFollowUpAt, notes: input.notes.trim() };
}

export function sourceRequestTemplate(type: string, caseNumber: string) {
  const requested: Record<string, string> = {
    EDUCATION:
      "Please confirm the qualification, institution, attendance dates and award status against your authorised records.",
    EMPLOYMENT:
      "Please confirm the employment dates, job title and separation details that you are authorised to disclose.",
    REFERENCE:
      "Please state your professional relationship and dates, and provide factual observations supported by your direct knowledge.",
    COMPANY_REGISTRATION:
      "Please confirm the organisation registration, legal status and registered particulars from authorised records.",
  };
  return {
    subject: `Authorised verification request · ${caseNumber} · ${type.replaceAll("_", " ")}`,
    body: `We are reviewing the consented verification scope for case ${caseNumber}.\n\n${requested[type] ?? "Please confirm the facts within the agreed verification scope against your authorised records."}\n\nPlease include your name, capacity, record reference and response date. If you cannot confirm an item, mark it unverified and explain why. Do not send unrelated personal data. Use the agreed secure evidence channel.\n\nSapling Global verification team`,
    delivery: "COPY_ONLY" as const,
  };
}
