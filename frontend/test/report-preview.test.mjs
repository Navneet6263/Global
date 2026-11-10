import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("server security headers allow blob framing and object plugins for report PDF previews", () => {
  const serverSource = readFileSync(
    new URL("../src/server.ts", import.meta.url),
    "utf8",
  );

  assert.match(
    serverSource,
    /frame-src\s+'self'\s+blob:/,
    "CSP must include frame-src 'self' blob: to allow iframe report previews",
  );
  assert.match(
    serverSource,
    /object-src\s+'self'\s+blob:/,
    "CSP must include object-src 'self' blob: so browser PDF plugins can render preview streams",
  );
});

test("report preview integrates existing openDocumentPreview and saveBlob utilities", () => {
  const previewSource = readFileSync(
    new URL("../src/features/workflow-ui/ReportPreview.tsx", import.meta.url),
    "utf8",
  );

  assert.match(
    previewSource,
    /import\s+\{\s*openDocumentPreview\s*\}\s+from\s+["']@\/lib\/backend-api\/document-preview["']/,
    "ReportPreview must reuse openDocumentPreview for tab previews",
  );
  assert.match(
    previewSource,
    /import\s+\{\s*saveBlob\s*\}\s+from\s+["']@\/lib\/backend-api\/client["']/,
    "ReportPreview must reuse saveBlob for downloads",
  );
  assert.match(
    previewSource,
    /application\/pdf/,
    "ReportPreview must verify or construct application/pdf MIME type",
  );
});

test("report header details updates invalidate and actively refetch the preview query", () => {
  const headerSource = readFileSync(
    new URL("../src/features/workflow-ui/ReportHeaderDetails.tsx", import.meta.url),
    "utf8",
  );

  assert.match(
    headerSource,
    /queryClient\.refetchQueries\(\{\s*queryKey:\s*\["report-preview",\s*caseId\]\s*\}\)/,
    "ReportHeaderDetails must actively refetch report-preview on save",
  );
});

test("all report preview source files remain strictly below 300 lines", () => {
  const files = [
    "../src/server.ts",
    "../src/features/workflow-ui/ReportPreview.tsx",
    "../src/features/workflow-ui/ReportHeaderDetails.tsx",
  ];

  for (const file of files) {
    const content = readFileSync(new URL(file, import.meta.url), "utf8");
    const lines = content.split("\n").length;
    assert.ok(
      lines < 300,
      `File ${file} has ${lines} lines, which exceeds the 300 line limit`,
    );
  }
});
