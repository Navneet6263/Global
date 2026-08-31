import type { OperationsRepository } from "./operations-repository";
import {
  assignApiChecks,
  getApiAssignments,
  reassignApiChecks,
  runApiCaseAction,
} from "./api-operations-assignments";
import { getOperationsWorkspaceDashboard } from "./api-operations-dashboard";
import {
  assignApiExceptionOwner,
  escalateApiException,
  getApiExceptions,
  resolveApiException,
} from "./api-operations-exceptions";
import { getFieldOperations, getSlaPerformance, getTeamCapacity } from "./api-operations-insights";
import { baseCase, clarificationState, detailCase } from "./api-operations-mappers";
import { getCase, listAllClients } from "@/lib/backend-api/cases";
import { listAllOperationCases } from "./api-operations-cases";
import { resolveClarification } from "@/lib/backend-api/clarifications";
import { getExceptionsDashboard } from "@/lib/backend-api/dashboards";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/backend-api/notifications";
import { listAllUsers } from "@/lib/backend-api/users";

export function createApiOperationsRepository(_baseUrl: string): OperationsRepository {
  return {
    getDashboard: getOperationsWorkspaceDashboard,
    async getFacets() {
      const [clients, users] = await Promise.all([listAllClients(), listAllUsers("OPS_MANAGER")]);
      return {
        clients: clients.map((row) => ({ value: row.publicId, label: row.displayName })),
        owners: users.items.map((row) => ({ value: row.displayName, label: row.displayName })),
        packages: [],
        branches: [
          ...new Map(
            users.items
              .filter((row) => row.branch)
              .map((row) => [
                row.branch!.publicId,
                { value: row.branch!.publicId, label: row.branch!.name },
              ]),
          ).values(),
        ],
      };
    },
    async getCases(query) {
      const items = await listAllOperationCases({
        search: query.search,
        clientId: query.clientId === "all" ? undefined : query.clientId,
      });
      let rows = items.map(baseCase);
      if (query.stage && query.stage !== "all")
        rows = rows.filter((row) => row.stage === query.stage);
      if (query.priority && query.priority !== "all")
        rows = rows.filter((row) => row.priority === query.priority);
      if (query.risk && query.risk !== "all") rows = rows.filter((row) => row.risk === query.risk);
      if (query.sla && query.sla !== "all") rows = rows.filter((row) => row.slaState === query.sla);
      if (query.owner && query.owner !== "all")
        rows = rows.filter((row) => row.opsOwner === query.owner);
      if (query.unassigned) rows = rows.filter((row) => !row.opsOwner);
      if (query.dueToday) {
        const end = new Date();
        end.setHours(23, 59, 59, 999);
        rows = rows.filter((row) => {
          const minutesUntilEnd = (end.getTime() - Date.now()) / 60_000;
          return row.slaMinutesRemaining >= 0 && row.slaMinutesRemaining <= minutesUntilEnd;
        });
      }
      if (query.dueNext7Days) {
        rows = rows.filter(
          (row) => row.slaMinutesRemaining >= 0 && row.slaMinutesRemaining <= 7 * 24 * 60,
        );
      }
      const page = query.page ?? 1;
      const pageSize = query.pageSize ?? 10;
      return {
        rows: rows.slice((page - 1) * pageSize, page * pageSize),
        total: rows.length,
        page,
        pageSize,
      };
    },
    async getCase(caseId) {
      try {
        return detailCase(await getCase(caseId));
      } catch {
        return null;
      }
    },
    runCaseAction: runApiCaseAction,
    getAssignments: getApiAssignments,
    assignCase: assignApiChecks,
    reassignCase: reassignApiChecks,
    getExceptions: getApiExceptions,
    resolveException: resolveApiException,
    escalateException: escalateApiException,
    assignExceptionOwner: assignApiExceptionOwner,
    getSlaPerformance,
    getTeamCapacity,
    getFieldOperations,
    async getClarifications(query) {
      const data = await getExceptionsDashboard();
      let rows = data.clarifications.map((row) => ({
        id: row.id,
        caseId: row.case.publicId,
        caseNumber: row.case.caseNumber,
        candidateName: row.case.subject.fullName,
        clientName: row.case.client.displayName,
        checkLabel: "Case",
        subject: row.subject,
        audience: "client" as const,
        state: clarificationState(row.status),
        requestedBy: "Operations",
        requestedAt: row.createdAt,
        dueAt: row.dueAt ?? row.createdAt,
        overdue: Boolean(
          row.dueAt && Date.parse(row.dueAt) < Date.now() && row.status !== "RESOLVED",
        ),
        messages: row.latestMessage
          ? [
              {
                id: `${row.id}-latest`,
                author: row.latestMessage.senderType,
                at: row.latestMessage.createdAt,
                body: row.latestMessage.body,
                internal: false,
              },
            ]
          : [],
      }));
      if (query.search) {
        const search = query.search.toLowerCase();
        rows = rows.filter((row) =>
          `${row.caseNumber} ${row.candidateName} ${row.subject}`.toLowerCase().includes(search),
        );
      }
      if (query.state && query.state !== "all") {
        rows = rows.filter((row) =>
          query.state === "overdue" ? row.overdue : row.state === query.state,
        );
      }
      return rows;
    },
    async respondToClarification(input) {
      const data = await getExceptionsDashboard();
      const row = data.clarifications.find((item) => item.id === input.clarificationId);
      if (!row) throw new Error("Clarification not found");
      if (input.action !== "resolve") throw new Error("Unsupported clarification action");
      await resolveClarification(row.case.publicId, row.id, input.note);
      return {
        clarificationId: row.id,
        state: "resolved",
        message: "Clarification resolved",
      };
    },
    async getNotifications() {
      const response = await listNotifications();
      return response.items.map((item) => ({
        id: item.id,
        type: item.type.toLowerCase().includes("sla")
          ? ("sla_approaching" as const)
          : item.type.toLowerCase().includes("field")
            ? ("field_exception" as const)
            : item.type.toLowerCase().includes("qa")
              ? ("qa_returned" as const)
              : ("assignment_changed" as const),
        title: item.title,
        detail: item.body,
        at: item.createdAt,
        read: Boolean(item.readAt),
        caseId: null,
        caseNumber: null,
        tone: item.type.toLowerCase().includes("sla") ? ("warning" as const) : ("info" as const),
      }));
    },
    async markNotificationRead(id) {
      await markNotificationRead(id);
    },
    async markAllNotificationsRead() {
      await markAllNotificationsRead();
    },
  };
}
