import { UnauthorizedException } from "@nestjs/common";
import { createHash, timingSafeEqual } from "node:crypto";
import type { PrismaService } from "../database/prisma.service";

export function digestPortalToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/** Shows staff where the link went without revealing the full address. */
export function maskDestination(value: string, channel: "EMAIL" | "SMS") {
  if (channel === "SMS") return `${value.slice(0, 3)}******${value.slice(-2)}`;
  const [name, domain] = value.split("@");
  return `${(name ?? "candidate").slice(0, 2)}***@${domain ?? "hidden"}`;
}

/**
 * The candidate link's only gate: an unrevoked, unexpired access whose token hash
 * matches (constant-time). Returns the access with the case data the portal shows.
 */
export async function authorizeCandidateAccess(
  prisma: PrismaService,
  publicId: string,
  token: string,
) {
  const access = await prisma.candidatePortalAccess.findUnique({
    where: { publicId },
    include: {
      tenant: { select: { publicId: true } },
      case: {
        include: {
          subject: { select: { fullName: true } },
          client: { select: { displayName: true } },
          checks: {
            select: { type: true, status: true },
            orderBy: { createdAt: "asc" },
          },
          documents: {
            select: {
              type: true,
              status: true,
              currentVersion: true,
              reviewNote: true,
              expiresAt: true,
            },
            orderBy: { createdAt: "desc" },
          },
          clarifications: {
            select: {
              id: true,
              publicId: true,
              subject: true,
              status: true,
              dueAt: true,
              messages: {
                select: { senderType: true, body: true, createdAt: true },
                orderBy: { createdAt: "asc" },
              },
            },
            orderBy: { createdAt: "desc" },
          },
          consents: {
            select: { status: true },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
          reports: { select: { status: true } },
        },
      },
    },
  });
  if (!access || access.revokedAt || access.expiresAt <= new Date())
    throw new UnauthorizedException(
      "Candidate access link is invalid or expired",
    );
  const expected = Buffer.from(access.tokenHash);
  const actual = Buffer.from(digestPortalToken(token));
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual))
    throw new UnauthorizedException(
      "Candidate access link is invalid or expired",
    );
  return access;
}
