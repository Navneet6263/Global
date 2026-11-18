import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("team member wizard and document files stay strictly below 300 lines", () => {
  const files = [
    "../../backend/src/workflow/team-member-documents.ts",
    "../../backend/src/workflow/team-member-documents.service.ts",
    "../../backend/src/workflow/team-members.controller.ts",
    "../../backend/src/workflow/workflow.module.ts",
    "../src/lib/backend-api/team-members.ts",
    "../src/features/workflow-ui/TeamMemberRow.tsx",
    "../src/features/workflow-ui/TeamMemberDocumentsDialog.tsx",
    "../src/features/workflow-ui/AddMemberAccessStep.tsx",
    "../src/features/workflow-ui/AddMemberDocumentsStep.tsx",
    "../src/features/workflow-ui/AddMemberDialog.tsx",
    "../src/features/workflow-ui/TeamMembers.tsx",
  ];

  for (const file of files) {
    const content = readFileSync(new URL(file, import.meta.url), "utf8");
    const lines = content.split("\n").length;
    assert.ok(
      lines < 300,
      `File ${file} has ${lines} lines, which exceeds the strict 299 maximum!`,
    );
  }
});

test("team member wizard defines exactly 4 sequential steps with documents as Step 4", () => {
  const dialogContent = readFileSync(
    new URL("../src/features/workflow-ui/AddMemberDialog.tsx", import.meta.url),
    "utf8",
  );
  assert.ok(
    dialogContent.includes(
      'const STEPS = ["Details", "Team & access", "Review", "Agreement & documents"] as const;',
    ),
    "Wizard STEPS array must be exactly: Details, Team & access, Review, Agreement & documents",
  );
});

test("team member documents step enforces identity and agreement rules", () => {
  const docsStepContent = readFileSync(
    new URL("../src/features/workflow-ui/AddMemberDocumentsStep.tsx", import.meta.url),
    "utf8",
  );
  assert.ok(
    docsStepContent.includes(
      'const ALLOWED_EXTENSIONS = [".png", ".jpg", ".jpeg", ".pdf", ".doc", ".docx"];',
    ),
    "Supported file types must be PNG, JPG, JPEG, PDF, DOC, DOCX",
  );
  assert.ok(docsStepContent.includes("10 * 1024 * 1024"), "Max file size must be 10 MB");
  assert.ok(
    docsStepContent.includes("Maximum 2 identity documents reached"),
    "Must cap identity documents at 2",
  );
  assert.ok(
    docsStepContent.includes("At least 1 Identity document is required"),
    "Must require at least 1 identity document",
  );
  assert.ok(
    docsStepContent.includes("1 Agreement document is required to create a team member."),
    "Must require 1 agreement document",
  );
});

test("createTeamMemberWithDocuments sends x-content-sha256 header", () => {
  const apiContent = readFileSync(
    new URL("../src/lib/backend-api/team-members.ts", import.meta.url),
    "utf8",
  );
  assert.ok(
    apiContent.includes('"x-content-sha256": digest'),
    "createTeamMemberWithDocuments must provide the x-content-sha256 idempotency digest header",
  );
});

test("team member row includes View documents action and dialog", () => {
  const rowContent = readFileSync(
    new URL("../src/features/workflow-ui/TeamMemberRow.tsx", import.meta.url),
    "utf8",
  );
  assert.ok(
    rowContent.includes("View documents"),
    "TeamMemberRow must include View documents action in 3-dot dropdown",
  );
  assert.ok(
    rowContent.includes("TeamMemberDocumentsDialog"),
    "TeamMemberRow must mount TeamMemberDocumentsDialog",
  );
});
