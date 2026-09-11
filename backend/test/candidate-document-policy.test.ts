import assert from "node:assert/strict";
import test from "node:test";
import type { Prisma } from "../src/generated/prisma/client";
import { assertCandidateDocumentType } from "../src/documents/candidate-document-policy";

function database(requiredDocumentsJson: string) {
  return {
    caseService: {
      findMany: () => Promise.resolve([{ requiredDocumentsJson }]),
    },
  } as unknown as Prisma.TransactionClient;
}

void test("business supporting documents are candidate-uploadable only when requested by the case scope", async () => {
  await assertCandidateDocumentType(database('["OTHER"]'), 1n, "OTHER");
  await assert.rejects(
    assertCandidateDocumentType(database('["PAN"]'), 1n, "OTHER"),
    /not requested/,
  );
  await assert.rejects(
    assertCandidateDocumentType(database("[]"), 1n, "UNKNOWN"),
    /not requested/,
  );
  await assertCandidateDocumentType(database("[]"), 1n, "PAN");
});
