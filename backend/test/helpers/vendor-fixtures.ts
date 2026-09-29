import type { PrismaService } from "../../src/database/prisma.service";
import type { DocumentsService } from "../../src/documents/documents.service";
import { AssignVendorService } from "../../src/vendor-requests/services/assign-vendor.service";
import { DecideVendorRequestService } from "../../src/vendor-requests/services/decide-vendor-request.service";
import { ReassignVendorService } from "../../src/vendor-requests/services/reassign-vendor.service";
import { SpocVendorMonitorService } from "../../src/vendor-requests/services/spoc-vendor-monitor.service";
import { VendorInboxService } from "../../src/vendor-requests/services/vendor-inbox.service";
import { SpocVendorsRepository } from "../../src/vendor-requests/spoc-vendors.repository";
import { VendorAssignmentsRepository } from "../../src/vendor-requests/vendor-assignments.repository";
import { VendorRequestsRepository } from "../../src/vendor-requests/vendor-requests.repository";
import { testActor } from "./test-actor";

export const CLIENT_A = "11111111-1111-4111-8111-111111111111";
export const CLIENT_B = "22222222-2222-4222-8222-222222222222";
export const DOC = "33333333-3333-4333-8333-333333333333";
export const VENDOR_1 = "44444444-4444-4444-8444-444444444444";
export const VENDOR_2 = "66666666-6666-4666-8666-666666666666";
export const REQ = "55555555-5555-4555-8555-555555555555";

export type Args = {
  where?: Record<string, unknown>;
  data?: Record<string, unknown>;
};
export type Seen = Record<string, unknown>;

export const admin = testActor(["PLATFORM_ADMIN"], ["*"]);
export const spocA = testActor(
  ["SPOC_RM"],
  ["dashboard:read", "notification:read", "vendor:assign"],
  { spocClients: [{ id: 21n, publicId: CLIENT_A, name: "Client A" }] },
);
export const vendorOne = testActor(
  ["VENDOR"],
  ["vendor:review", "notification:read"],
  { userId: 31n, displayName: "Acme Vendors" },
);
export const opsBranch = testActor(["OPS_MANAGER"], ["user:read"], {
  branchId: 5n,
  branchPublicId: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
});

export function args(seen: Seen, key: string): Args {
  return seen[key] as Args;
}

/** SPOC-RM assign and re-assign over one repository, as the module wires them. */
export function vendorWriters(prisma: PrismaService) {
  const repository = new VendorAssignmentsRepository(prisma);
  const assigner = new AssignVendorService(repository);
  const reassigner = new ReassignVendorService(repository);
  return {
    assign: (...input: Parameters<AssignVendorService["assign"]>) =>
      assigner.assign(...input),
    reassign: (...input: Parameters<ReassignVendorService["reassign"]>) =>
      reassigner.reassign(...input),
  };
}

/** The Vendor workspace: inbox reads and decisions. */
export function vendorWorkspace(
  prisma: PrismaService,
  files: DocumentsService,
) {
  const repository = new VendorRequestsRepository(prisma);
  const inbox = new VendorInboxService(repository, files);
  const decisions = new DecideVendorRequestService(repository);
  return {
    preview: (...input: Parameters<VendorInboxService["preview"]>) =>
      inbox.preview(...input),
    decide: (...input: Parameters<DecideVendorRequestService["decide"]>) =>
      decisions.decide(...input),
  };
}

export function spocMonitor(prisma: PrismaService, files: DocumentsService) {
  return new SpocVendorMonitorService(new SpocVendorsRepository(prisma), files);
}
