import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { createHash, timingSafeEqual } from "node:crypto";
import { PrismaService } from "../database/prisma.service";

export function digestClarificationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

@Injectable()
export class ClarificationTokenService {
  constructor(private readonly prisma: PrismaService) {}

  async authorize(publicId: string, token: string) {
    const clarification = await this.prisma.clarification.findUnique({
      where: { publicId },
      include: {
        case: {
          select: {
            publicId: true,
            caseNumber: true,
            assignedOpsUserId: true,
            branchId: true,
            clientId: true,
          },
        },
        messages: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!clarification) throw new NotFoundException("Clarification not found");
    if (
      !clarification.responseTokenHash ||
      !clarification.responseTokenExpiresAt ||
      clarification.responseTokenExpiresAt <= new Date()
    ) {
      throw new UnauthorizedException(
        "Clarification link is invalid or expired",
      );
    }
    const expected = Buffer.from(clarification.responseTokenHash);
    const actual = Buffer.from(digestClarificationToken(token));
    if (
      expected.length !== actual.length ||
      !timingSafeEqual(expected, actual)
    ) {
      throw new UnauthorizedException(
        "Clarification link is invalid or expired",
      );
    }
    return clarification;
  }
}
