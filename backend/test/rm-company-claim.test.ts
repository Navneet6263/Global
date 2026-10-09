import assert from "node:assert/strict";
import { test } from "node:test";
import { claimCompaniesWithoutRm } from "../src/users/spoc-client-scope";

function harness(
  clients: Array<{ id: bigint; primaryRmUserId: bigint | null }>,
) {
  const updates: unknown[] = [];
  const audits: Array<{ data: { action: string; afterJson: string } }> = [];
  const tx = {
    user: {
      findFirst: () => Promise.resolve({ id: 70n, displayName: "Niku" }),
    },
    client: {
      findMany: ({ where }: { where: { id: { in: bigint[] } } }) =>
        Promise.resolve(
          clients
            .filter(
              (row) =>
                where.id.in.includes(row.id) && row.primaryRmUserId === null,
            )
            .map((row) => ({
              id: row.id,
              publicId: `client-${row.id}`,
              displayName: `Company ${row.id}`,
              version: 1,
            })),
        ),
      updateMany: (input: unknown) => {
        updates.push(input);
        return Promise.resolve({ count: 1 });
      },
    },
    auditEvent: {
      create: (input: { data: { action: string; afterJson: string } }) => {
        audits.push(input);
        return Promise.resolve({});
      },
    },
  };
  return { tx, updates, audits };
}

void test("a company picked on an RM's ID gets that RM as company RM, audited", async () => {
  const { tx, updates, audits } = harness([
    { id: 1n, primaryRmUserId: null },
    { id: 2n, primaryRmUserId: 99n },
  ]);
  const claimed = await claimCompaniesWithoutRm(tx as never, {
    tenantId: 7n,
    actorUserId: 1n,
    rmPublicId: "rm-niku",
    clientIds: [1n, 2n],
  });
  // Only the company without an RM changes; an existing RM is never replaced.
  assert.deepEqual(claimed, ["Company 1"]);
  assert.equal(updates.length, 1);
  assert.equal(audits[0]!.data.action, "client.primary-rm-assigned");
  assert.equal(JSON.parse(audits[0]!.data.afterJson).primaryRmName, "Niku");
});

void test("no companies selected means no change", async () => {
  const { tx, updates } = harness([{ id: 1n, primaryRmUserId: null }]);
  assert.deepEqual(
    await claimCompaniesWithoutRm(tx as never, {
      tenantId: 7n,
      actorUserId: 1n,
      rmPublicId: "rm-niku",
      clientIds: [],
    }),
    [],
  );
  assert.equal(updates.length, 0);
});
