import type { Prisma } from "../generated/prisma/client";

/**
 * A main vendor that may be given work: created by Ops (no self-sign-up profile) or
 * self-signed-up and approved by Operations. Unapproved vendors never see candidate data.
 */
export const workReadyVendor = {
  OR: [
    { vendorProfile: { is: null } },
    { vendorProfile: { is: { verificationStatus: "APPROVED" } } },
  ],
} satisfies Prisma.UserWhereInput;
