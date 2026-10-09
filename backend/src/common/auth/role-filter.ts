/**
 * A user holding `code`, either the system role itself or a custom role built on it
 * (for example "Verifier · Rahul" has baseRoleCode VERIFIER). Use this wherever people
 * are looked up by role so custom-role users are never left out.
 */
export const roleIs = (code: string) => ({
  OR: [{ code }, { baseRoleCode: code }],
});

export const roleIn = (codes: readonly string[]) => ({
  OR: [{ code: { in: [...codes] } }, { baseRoleCode: { in: [...codes] } }],
});

/** Prisma user filter: has the role (or a custom role on it). */
export const hasRole = (code: string) => ({
  userRoles: { some: { role: roleIs(code) } },
});

/** The role a user-role row works as. */
export const effectiveRole = (role: {
  code: string;
  baseRoleCode?: string | null;
}) => role.baseRoleCode ?? role.code;
