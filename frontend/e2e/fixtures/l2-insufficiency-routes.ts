import type { Route } from "@playwright/test";
import { tinyPdf } from "./workflow-fixture";
import { buildPortalPayload, buildReentryItem, type SimVersion } from "./l2-insufficiency-data";
import { replyUnifiedL2Queue } from "./l2-unified-queue-helper";

export interface L2SimMutableState {
  caseStatus: string;
  depCheckStatus: string;
  currentVersion: number;
  lhsEntries: Array<Record<string, string>>;
  clarification: Record<string, unknown> | null;
  versions: SimVersion[];
}

export function handleL2WorkflowRoutes(input: {
  route: Route;
  req: ReturnType<Route["request"]>;
  url: URL;
  path: string;
  method: string;
  body: Record<string, unknown> | undefined;
  state: L2SimMutableState;
  clarPayload: () => Record<string, unknown> | null;
  iso: (h: number) => string;
}): Promise<void> | null {
  const { route, req, url, path, method, body, state, clarPayload, iso } = input;
  const reply = (json: unknown, status = 200) => route.fulfill({ status, json });

  if (path === "/public/candidate-access/acc-l2-1" && method === "GET") {
    return reply(
      buildPortalPayload({
        expiresAt: iso(72),
        caseStatus: state.caseStatus,
        depCheckStatus: state.depCheckStatus,
        currentVersion: state.currentVersion,
        clar: clarPayload(),
        rawClar: state.clarification,
      }),
    );
  }

  if (
    path === "/public/candidate-access/acc-l2-1/clarifications/clar-l2-1/submit" &&
    method === "POST"
  ) {
    const nextVer = state.versions.length + 1;
    const raw = req.postDataBuffer()?.toString("utf8") ?? "";
    const msgMatch = /name="message"\r\n\r\n([\s\S]*?)\r\n--/.exec(raw)?.[1]?.trim();
    const fileMatch = /filename="([^"]+)"/.exec(raw)?.[1];
    state.versions.push({
      version: nextVer,
      originalName: fileMatch || `corrected-v${nextVer}.pdf`,
      contentType: "application/pdf",
      sizeBytes: "40960",
      malwareState: "CLEAN",
      reviewStatus: "PENDING",
      reviewNote: null,
      reviewedAt: null,
      createdAt: iso(0),
      clarificationId: "clar-l2-1",
      isSubmitted: true,
    });
    const prevMsgs = (state.clarification?.messages as unknown[]) ?? [];
    state.clarification = {
      ...state.clarification,
      status: "CANDIDATE_SUBMITTED",
      submittedDocumentVersion: nextVer,
      updatedAt: iso(0),
      messages: [
        ...prevMsgs,
        { senderType: "CANDIDATE", body: msgMatch || `Uploaded v${nextVer}`, createdAt: iso(0) },
      ],
    };
    return reply({
      clarificationId: "clar-l2-1",
      status: "CANDIDATE_SUBMITTED",
      documentId: "doc-l2-1",
      documentType: String(state.clarification.requestedDocumentType),
      submittedDocumentVersion: nextVer,
      preservedBaseline: true,
      submittedAt: iso(0),
    });
  }

  if (path === "/clarifications/l2/ops-queue" && method === "GET") {
    const stFilter = url.searchParams.get("status");
    const base = state.clarification
      ? [
          {
            ...clarPayload(),
            case: {
              id: "case-l2-1",
              caseNumber: "SG-2026-L201",
              status: state.caseStatus,
              workflowVersion: 3,
              intakeStage: "ROUTED",
              dataEntryUser: { id: "de-sara", displayName: "Sara Khan" },
              subjectName: "Asha Verma",
              clientName: "Horizon Tech",
            },
            check: { id: "chk-emp-l2", type: "EMPLOYMENT", status: "IN_PROGRESS" },
          },
        ]
      : [];
    const items = !stFilter
      ? base.filter((i) =>
          ["OPEN", "CANDIDATE_SUBMITTED", "DATA_ENTRY_PENDING"].includes(String(i.status)),
        )
      : stFilter === "ALL"
        ? base
        : base.filter((i) => i.status === stFilter);
    return reply({
      items,
      dataEntryUsers: [
        { id: "de-sara", displayName: "Sara Khan" },
        { id: "de-ankit", displayName: "Ankit Rao" },
      ],
    });
  }

  if (path === "/clarifications/clar-l2-1/ops-complete" && method === "POST") {
    if (state.clarification?.status !== "CANDIDATE_SUBMITTED") {
      return reply({ title: "Not ready for Ops handoff" }, 409);
    }
    state.clarification = {
      ...state.clarification,
      status: "DATA_ENTRY_PENDING",
      opsReviewedAt: iso(0),
      opsReviewNote: (body?.note as string | undefined) ?? null,
      opsReviewedBy: { id: "ops-ananya", displayName: "Ananya Rao" },
      updatedAt: iso(0),
    };
    return reply({
      id: "clar-l2-1",
      status: "DATA_ENTRY_PENDING",
      opsReviewedAt: iso(0),
      dataEntryUser: {
        id: (body?.dataEntryUserId as string | undefined) ?? "de-sara",
        displayName: "Sara Khan",
      },
    });
  }

  const reentryItem = () =>
    buildReentryItem({
      clar: clarPayload(),
      caseStatus: state.caseStatus,
      depCheckStatus: state.depCheckStatus,
      lhsEntries: state.lhsEntries,
      initiatedAt: iso(-20),
    });

  if (path === "/workflow/data-entry/unified-queue" && method === "GET") {
    return replyUnifiedL2Queue({ route, url, state, reentryItem, iso });
  }

  if (path === "/workflow/clarifications/reentry" && method === "GET") {
    return reply({
      items: state.clarification?.status === "DATA_ENTRY_PENDING" ? [reentryItem()] : [],
    });
  }

  if (path === "/workflow/clarifications/clar-l2-1" && method === "GET") {
    return reply(reentryItem());
  }

  if (path === "/workflow/clarifications/clar-l2-1/reject-document" && method === "POST") {
    const requestedVer =
      (body?.documentVersion as number | undefined) ??
      (state.clarification?.submittedDocumentVersion as number | undefined);
    const targetVer = state.versions.find((v) => v.version === requestedVer);
    const reason = String(body?.reason ?? "");
    if (targetVer) {
      targetVer.reviewStatus = "REJECTED";
      targetVer.reviewNote = reason;
      targetVer.reviewedAt = iso(0);
    }
    const count = Number(state.clarification?.rejectionCount ?? 0) + 1;
    const prevMsgs = (state.clarification?.messages as unknown[]) ?? [];
    state.clarification = {
      ...state.clarification,
      status: "OPEN",
      rejectionCount: count,
      lastRejectedAt: iso(0),
      lastRejectedReason: reason,
      messages: [...prevMsgs, { senderType: "OPS_USER", body: reason, createdAt: iso(0) }],
    };
    return reply({
      id: "clar-l2-1",
      status: "OPEN",
      rejectedVersion: targetVer?.version ?? 2,
      rejectionCount: count,
      lastRejectedAt: iso(0),
      lastRejectedReason: reason,
      preservedVerifiedBaseline: state.versions[0].reviewStatus === "VERIFIED",
    });
  }

  if (path === "/workflow/clarifications/clar-l2-1/complete-reentry" && method === "POST") {
    const targetVer = Number(
      body?.documentVersion ??
        state.clarification?.submittedDocumentVersion ??
        state.currentVersion,
    );
    state.versions.forEach((v) => {
      if (v.version === targetVer) {
        v.reviewStatus = "VERIFIED";
        v.reviewedAt = iso(0);
      } else if (v.reviewStatus === "VERIFIED") {
        v.reviewStatus = "SUPERSEDED";
      }
    });
    state.currentVersion = targetVer;
    if (Array.isArray(body?.entries)) {
      state.lhsEntries = body.entries as Array<Record<string, string>>;
    }
    state.caseStatus = "IN_PROGRESS";
    state.depCheckStatus = "IN_PROGRESS";
    const note = (body?.note as string | undefined) ?? null;
    const prevMsgs = (state.clarification?.messages as unknown[]) ?? [];
    state.clarification = {
      ...state.clarification,
      status: "RESOLVED",
      resolvedAt: iso(0),
      reentryCompletedAt: iso(0),
      dataEntryReviewedAt: iso(0),
      dataEntryReviewNote: note,
      dataEntryReviewedBy: { id: "de-sara", displayName: "Sara Khan" },
      reentryCompletedBy: { id: "de-sara", displayName: "Sara Khan" },
      messages: [
        ...prevMsgs,
        ...(note ? [{ senderType: "OPS_USER", body: note, createdAt: iso(0) }] : []),
      ],
    };
    return reply({
      id: "clar-l2-1",
      status: "RESOLVED",
      caseStatus: state.caseStatus,
      promotedDocumentVersion: targetVer,
      reopenedDependentCount: 1,
      reentryCompletedAt: iso(0),
    });
  }

  if (/^\/documents\/doc-l2-1\/(preview|content)$/.test(path)) {
    const ver = url.searchParams.get("version") ?? state.currentVersion;
    return route.fulfill({
      status: 200,
      contentType: "application/pdf",
      body: tinyPdf(`Doc v${ver}`),
    });
  }

  return null;
}
