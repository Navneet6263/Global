import { BadRequestException } from "@nestjs/common";

/**
 * System roles a custom role may be based on. Client, RM, vendor, support and admin
 * roles carry extra scoping rules, so they are not offered as bases.
 */
export const CUSTOM_ROLE_BASES = [
  "DATA_ENTRY",
  "VERIFIER",
  "QA_REVIEWER",
  "FINANCE_MANAGER",
  "FIELD_EXECUTIVE",
] as const;
export type CustomRoleBase = (typeof CUSTOM_ROLE_BASES)[number];

export function customRoleCode(name: string) {
  const slug = name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 36);
  if (!slug) throw new BadRequestException("Give the role a name");
  return `CUSTOM_${slug}`;
}
