import { createHash } from "node:crypto";
import type { PrismaService } from "../database/prisma.service";
import type { LocalObjectStorageService } from "../documents/local-object-storage.service";
import type { ReportData } from "./report-data";

/**
 * Reads the proof files a report refers to from storage. A file is only used when its
 * bytes still match the SHA-256 recorded with the report; anything missing or changed
 * is left out and the report lists it as held on the portal instead.
 */
export async function loadProofBytes(
  prisma: PrismaService,
  storage: LocalObjectStorageService,
  tenantId: bigint,
  data: Pick<ReportData, "checks">,
): Promise<Map<string, Uint8Array>> {
  const wanted = new Map(
    data.checks.flatMap((check) =>
      (check.proofs ?? []).map((proof) => [proof.id, proof.sha256] as const),
    ),
  );
  const bytes = new Map<string, Uint8Array>();
  if (!wanted.size) return bytes;
  const rows = await prisma.checkEvidence.findMany({
    where: { tenantId, publicId: { in: [...wanted.keys()] } },
    select: { publicId: true, objectKey: true },
  });
  for (const row of rows) {
    try {
      const contents = await storage.get(row.objectKey);
      const sha256 = createHash("sha256").update(contents).digest("hex");
      if (sha256 === wanted.get(row.publicId))
        bytes.set(row.publicId, contents);
    } catch {
      // Missing object: the report lists the file as held on the portal.
    }
  }
  return bytes;
}
