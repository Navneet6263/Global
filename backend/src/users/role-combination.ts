import { ConflictException } from "@nestjs/common";

export function assertSafeRoleCombination(
  roleCodes: readonly string[],
  additionalAccessConfirmed?: boolean,
): void {
  const unique = [...new Set(roleCodes)];
  if (unique.length <= 1) return;
  if (!additionalAccessConfirmed) {
    throw new ConflictException(
      "Additional role access must be explicitly confirmed",
    );
  }
  if (unique.includes("PLATFORM_ADMIN")) {
    throw new ConflictException(
      "Platform Admin is full access and cannot be combined with another role",
    );
  }
  if (unique.includes("CLIENT_ADMIN")) {
    throw new ConflictException(
      "Client Admin is client-scoped and cannot be combined with an internal role",
    );
  }
}
