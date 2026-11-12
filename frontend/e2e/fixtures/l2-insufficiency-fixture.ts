import type { Page } from "@playwright/test";
import {
  ACTOR_PROFILES,
  EMP_INIT_FORM,
  EMP_RHS_FORM,
  L2_COLOUR_MATRIX,
  L2_TASK_INSIGHTS,
  buildCheckEvidence,
  buildInitialClarification,
  buildSubmittedDoc,
  type L2ActorRole,
} from "./l2-insufficiency-data";
import { handleL2WorkflowRoutes, type L2SimMutableState } from "./l2-insufficiency-routes";

export type { L2ActorRole };

export async function setupL2InsufficiencyFixture(page: Page) {
  const now = Date.now();
  const iso = (h: number) => new Date(now + h * 3_600_000).toISOString();
  const requests: Array<{ method: string; path: string; search: string; body?: unknown }> = [];
  let role: L2ActorRole = "VERIFIER";
  let taskStatus = "OPEN";
  let taskVersion = 3;
  let rhsEntries: Array<Record<string, string>> = [];
  let completedOutcome: Record<string, unknown> | null = null;

  const state: L2SimMutableState = {
    caseStatus: "IN_PROGRESS",
    depCheckStatus: "COMPLETED",
    currentVersion: 1,
    lhsEntries: [{ employerName: "Acme Corp", empCode: "EMP-OLD" }],
    clarification: null,
    versions: [
      {
        version: 1,
        originalName: "relieving-letter-v1.pdf",
        contentType: "application/pdf",
        sizeBytes: "24576",
        malwareState: "CLEAN",
        reviewStatus: "VERIFIED",
        reviewNote: "Baseline verified at intake",
        reviewedAt: iso(-24),
        createdAt: iso(-24),
        clarificationId: null,
        isSubmitted: false,
      },
    ],
  };

  const submittedDoc = () =>
    buildSubmittedDoc(state.versions, state.currentVersion, state.clarification);
  const clarPayload = () =>
    state.clarification
      ? {
          ...state.clarification,
          submittedDocument: state.versions.length > 1 ? submittedDoc() : null,
          isForCurrentCheck: true,
        }
      : null;

  const taskPayload = () => ({
    id: "task-l2-1",
    status: taskStatus,
    version: taskVersion,
    blockerReason:
      state.clarification && state.clarification.status !== "RESOLVED"
        ? state.clarification.subject
        : null,
    createdAt: iso(-12),
    dueAt: iso(24),
    tlReview: false,
    review: completedOutcome,
    check: {
      id: "chk-emp-l2",
      publicId: "chk-emp-l2",
      type: "EMPLOYMENT",
      status: taskStatus === "COMPLETED" ? "COMPLETED" : "IN_PROGRESS",
      department: { id: "dep-emp", name: "Employment", teamType: "MANUAL" },
      initiationJson: JSON.stringify({ entries: state.lhsEntries }),
      initiatedAt: iso(-20),
      case: {
        id: "case-l2-1",
        publicId: "case-l2-1",
        caseNumber: "SG-2026-L201",
        status: state.caseStatus,
        priority: "HIGH",
        subject: { fullName: "Asha Verma" },
        client: { displayName: "Horizon Tech" },
        assignedOpsUser: { displayName: "Riya Mehta" },
        clarifications: clarPayload() ? [clarPayload()] : [],
      },
    },
  });

  await page.route("**/api/v1/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname.replace("/api/v1", "");
    const method = req.method();
    const ct = req.headers()["content-type"] ?? "";
    const body =
      req.postData() && !ct.includes("multipart/form-data")
        ? (JSON.parse(req.postData()!) as Record<string, unknown>)
        : undefined;
    requests.push({ method, path, search: url.search, body });
    const reply = (json: unknown, status = 200) => route.fulfill({ status, json });

    if (path === "/auth/me") {
      return reply({
        ...ACTOR_PROFILES[role],
        tenantId: "tenant-1",
        tenantName: "Sapling Global",
        permissions: ["*"],
        mustChangePassword: false,
      });
    }
    if (path === "/notifications") return reply({ items: [], unreadCount: 0 });
    if (path === "/dashboards/navigation") return reply({ counts: { opsClarifications: 1 } });
    if (path === "/dashboards/exceptions") return reply({ clarifications: [], exceptions: [] });
    if (path === "/workflow/colour-matrix") return reply(L2_COLOUR_MATRIX);
    if (path === "/tasks/mine/insights") return reply(L2_TASK_INSIGHTS);
    if (path === "/tasks/mine") {
      const done = taskStatus === "COMPLETED";
      const items =
        url.searchParams.get("status") === "COMPLETED"
          ? done
            ? [taskPayload()]
            : []
          : done
            ? []
            : [taskPayload()];
      return reply({
        items,
        nextCursor: null,
        summary: { active: done ? 0 : 1, overdue: 0, blocked: 0, completedToday: done ? 1 : 0 },
      });
    }
    if (path === "/tasks/task-l2-1/context") {
      return reply({
        publicId: "task-l2-1",
        createdAt: iso(-12),
        check: {
          ...taskPayload().check,
          case: {
            ...taskPayload().check.case,
            documents: [submittedDoc()],
            consents: [
              { status: "ACCEPTED", purpose: "BGV", noticeVersion: "1", createdAt: iso(-25) },
            ],
            statusHistory: [],
          },
        },
      });
    }
    if (path === "/vendor-checks/check/chk-emp-l2") {
      return reply({ canManage: false, attempts: [] });
    }
    if (path === "/tasks/task-l2-1/notes" || path === "/tasks/task-l2-1/methods") {
      return reply({ items: [] });
    }
    if (path === "/checks/chk-emp-l2/evidence") return reply(buildCheckEvidence(iso(-10)));
    if (path === "/checks/chk-emp-l2/verified-details" && method === "GET") {
      return reply({
        checkId: "chk-emp-l2",
        type: "EMPLOYMENT",
        statusLabel: "In progress",
        lhs: { form: EMP_INIT_FORM, entries: state.lhsEntries },
        rhs: {
          form: EMP_RHS_FORM,
          entries: rhsEntries,
          verifiedAt: rhsEntries.length ? iso(0) : null,
        },
      });
    }
    if (path === "/checks/chk-emp-l2/verified-details" && method === "PUT") {
      rhsEntries = (body?.entries as Array<Record<string, string>>) ?? [];
      return reply({ checkId: "chk-emp-l2", verifiedAt: iso(0), entries: rhsEntries });
    }
    if (path === "/tasks/task-l2-1" && method === "PATCH") {
      taskStatus = String(body?.status ?? "COMPLETED");
      taskVersion += 1;
      if (taskStatus === "COMPLETED") {
        completedOutcome = {
          result: body?.result,
          disposition: body?.disposition,
          sourceSummary: body?.sourceSummary,
          completedAt: iso(0),
        };
      }
      return reply({
        id: "task-l2-1",
        status: taskStatus,
        version: taskVersion,
        tlReview: false,
        canForward: false,
      });
    }
    if (path === "/cases/case-l2-1/clarifications" && method === "GET") {
      return reply({ items: clarPayload() ? [clarPayload()] : [] });
    }
    if (path === "/cases/case-l2-1/clarifications" && method === "POST") {
      if (
        state.clarification &&
        ["OPEN", "CANDIDATE_SUBMITTED", "DATA_ENTRY_PENDING"].includes(
          String(state.clarification.status),
        )
      ) {
        return reply({ title: "Active L2 clarification already exists" }, 409);
      }
      state.caseStatus = "CLARIFICATION_PENDING";
      state.clarification = buildInitialClarification({
        body,
        dueAt: iso(48),
        nowIso: iso(0),
      });
      return reply(
        {
          id: "clar-l2-1",
          status: "OPEN",
          subject: body?.subject,
          portalToken: "tok-l2-1",
          tokenExpiresAt: iso(72),
        },
        201,
      );
    }

    const handled = handleL2WorkflowRoutes({
      route,
      req,
      url,
      path,
      method,
      body,
      state,
      clarPayload,
      iso,
    });
    if (handled) return handled;

    if (path.startsWith("/workflow/data-entry/queue")) {
      return reply({
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
        counts: { waiting: 0, ready: 0, correction: 0 },
      });
    }
    return reply({ items: [], total: 0, nextCursor: null });
  });

  return {
    requests,
    switchRole(nextRole: L2ActorRole) {
      role = nextRole;
    },
    getState() {
      return {
        caseStatus: state.caseStatus,
        taskStatus,
        depCheckStatus: state.depCheckStatus,
        currentVersion: state.currentVersion,
        versions: state.versions.map((v) => ({ version: v.version, reviewStatus: v.reviewStatus })),
        lhsEntries: state.lhsEntries,
      };
    },
  };
}
