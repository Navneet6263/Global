import type { Prisma } from "../generated/prisma/client";
import { workReadyVendor } from "../vendor-onboarding/vendor-approval";

/**
 * City and pincode of the check's first address entry: what a vendor sees before picking
 * (never the street address or the candidate's name).
 */
export function queueLocation(initiationJson: string | null | undefined) {
  try {
    const parsed = JSON.parse(initiationJson ?? "") as {
      entries?: Array<Record<string, unknown>>;
    };
    const entry = Array.isArray(parsed.entries) ? parsed.entries[0] : undefined;
    const text = (key: string, max: number) => {
      const value = entry?.[key];
      return typeof value === "string" && value.trim()
        ? value.trim().slice(0, max)
        : null;
    };
    return { city: text("city", 120), pincode: text("pincode", 12) };
  } catch {
    return { city: null, pincode: null };
  }
}

/** Every approved main vendor (and its active team) hears about a new queued check. */
export async function notifyQueueVendors(
  tx: Prisma.TransactionClient,
  tenantId: bigint,
  check: { checkType: string; city: string | null; price: number | null },
) {
  const vendors = await tx.user.findMany({
    where: {
      tenantId,
      status: "ACTIVE",
      userRoles: { some: { role: { code: "VENDOR" } } },
      OR: [
        { vendorOwnerId: null, ...workReadyVendor },
        { vendorOwner: { status: "ACTIVE", ...workReadyVendor } },
      ],
    },
    select: { id: true },
    take: 2000,
  });
  if (!vendors.length) return 0;
  const type = check.checkType.replaceAll("_", " ").toLowerCase();
  await tx.notification.createMany({
    data: vendors.map((vendor) => ({
      tenantId,
      userId: vendor.id,
      type: "VENDOR_QUEUE_NEW",
      title: `New in the open queue: ${type}`,
      body: [
        check.city,
        check.price !== null ? `₹${check.price.toLocaleString("en-IN")}` : null,
      ]
        .filter(Boolean)
        .join(" · "),
      href: "/vendor/queue",
    })),
  });
  return vendors.length;
}
