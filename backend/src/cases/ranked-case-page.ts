import type { PrismaService } from "../database/prisma.service";
import type { Prisma } from "../generated/prisma/client";
import { caseListSelect } from "./case.selects";

const statusGroups = [
  ["DRAFT"],
  ["CONSENT_PENDING"],
  ["DOCUMENT_PENDING"],
  ["IN_PROGRESS"],
  ["CLARIFICATION_PENDING"],
  ["QA_REVIEW"],
  ["COMPLETED", "CLOSED", "CANCELLED"],
];
const priorityGroups = [["NORMAL"], ["HIGH"], ["URGENT"]];

export function pageSlices(counts: number[], skip: number, take: number) {
  const slices: { group: number; skip: number; take: number }[] = [];
  for (let group = 0; group < counts.length && take > 0; group++) {
    const count = counts[group]!;
    if (skip >= count) {
      skip -= count;
      continue;
    }
    const size = Math.min(take, count - skip);
    slices.push({ group, skip, take: size });
    take -= size;
    skip = 0;
  }
  return slices;
}

export async function rankedCasePage(
  prisma: PrismaService,
  where: Prisma.VerificationCaseWhereInput,
  sort: "priority" | "progress",
  direction: "asc" | "desc",
  page: number,
  pageSize: number,
) {
  const field = sort === "priority" ? "priority" : "status";
  const groups = [...(sort === "priority" ? priorityGroups : statusGroups)];
  if (direction === "desc") groups.reverse();
  // Aggregate stage ranks match the UI's workflow progress, not check completion.
  const mix = await prisma.verificationCase.groupBy({
    by: [field],
    where,
    _count: { _all: true },
  });
  const counts = groups.map((group) =>
    mix
      .filter((row) => group.includes(row[field]))
      .reduce((sum, row) => sum + row._count._all, 0),
  );
  const slices = pageSlices(counts, (page - 1) * pageSize, pageSize);
  const batches = await Promise.all(
    slices.map((slice) =>
      prisma.verificationCase.findMany({
        where: { AND: [where, { [field]: { in: groups[slice.group] } }] },
        select: caseListSelect,
        orderBy: [{ updatedAt: "desc" }, { publicId: "desc" }],
        skip: slice.skip,
        take: slice.take,
      }),
    ),
  );
  return {
    rows: batches.flat(),
    total: counts.reduce((sum, count) => sum + count, 0),
  };
}
