import { BadRequestException } from "@nestjs/common";

type OnboardingClient = {
  billingTerms: string | null;
  billingAddress: string | null;
  packageRates: Array<{ active: boolean }>;
  agreements: Array<{
    type: string;
    signedAt: Date | null;
    expiresAt: Date | null;
    files?: Array<{ status: string }>;
  }>;
};

export function assertClientActivation(
  client: OnboardingClient,
  now = new Date(),
) {
  const missing: string[] = [];
  if (!client.billingTerms?.trim()) missing.push("billing terms");
  if (!client.billingAddress?.trim()) missing.push("billing address");
  if (!client.packageRates.some((rate) => rate.active))
    missing.push("an enabled contracted package");
  for (const type of ["AGREEMENT", "DPA"]) {
    if (
      !client.agreements.some(
        (row) =>
          row.type === type &&
          row.signedAt &&
          row.signedAt <= now &&
          row.files?.[0]?.status === "APPROVED" &&
          (!row.expiresAt || row.expiresAt > now),
      )
    ) {
      missing.push(
        `a current signed ${type} with an independently approved file`,
      );
    }
  }
  if (missing.length)
    throw new BadRequestException(
      `Complete onboarding before activation: ${missing.join(", ")}`,
    );
}
