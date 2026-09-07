import { ConflictException } from "@nestjs/common";

export const QA_CLAIM_MS = 30 * 60_000;
export function claimCutoff(now = new Date()) {
  return new Date(now.getTime() - QA_CLAIM_MS);
}

export function assertLiveClaim(claimedAt: Date | null, now = new Date()) {
  if (!claimedAt || claimedAt <= claimCutoff(now)) {
    throw new ConflictException(
      "Your QA reservation expired; refresh and claim the case again before deciding",
    );
  }
}
