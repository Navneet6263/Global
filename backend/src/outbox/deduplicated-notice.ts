import type { PrismaService } from "../database/prisma.service";

export async function deduplicatedNotice(
  prisma: PrismaService,
  input: {
    tenantId: bigint;
    resource: string;
    type: string;
    title: string;
    body: string;
    href: string;
    users: bigint[];
    windowHours?: number;
  },
  now = new Date(),
) {
  if (!input.users.length) return;
  return prisma.$transaction(async (tx) => {
    const key = `notice:${input.resource}:${input.type}`;
    const lock = await tx.$queryRaw<
      Array<{ result: number }>
    >`DECLARE @result int; EXEC @result = sp_getapplock @Resource = ${key}, @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 0; SELECT @result AS result;`;
    if ((lock[0]?.result ?? -1) < 0) return;
    const existing = await tx.notification.findMany({
      where: {
        tenantId: input.tenantId,
        type: input.type,
        href: input.href,
        createdAt: {
          gte: new Date(now.getTime() - (input.windowHours ?? 24) * 3_600_000),
        },
      },
      select: { userId: true },
    });
    const notified = new Set(existing.map((row) => row.userId));
    const data = [...new Set(input.users)]
      .filter((id) => !notified.has(id))
      .map((userId) => ({
        tenantId: input.tenantId,
        userId,
        type: input.type,
        title: input.title,
        body: input.body,
        href: input.href,
      }));
    if (data.length) await tx.notification.createMany({ data });
  });
}
