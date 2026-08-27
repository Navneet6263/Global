import type { OperationsRepository } from "./operations-repository";
import { getOperationsWorkspaceDashboard } from "./api-operations-dashboard";
import { getFieldOperations, getSlaPerformance, getTeamCapacity } from "./api-operations-insights";
import {
  baseCase,
  clarificationState,
  detailCase,
  priorityOf,
  slaOf,
  stages,
  typeOf,
} from "./api-operations-mappers";
import { getCase, listCases, listClients } from "@/lib/backend-api/cases";
import { getExceptionsDashboard } from "@/lib/backend-api/dashboards";
import { listUsers } from "@/lib/backend-api/users";
import { createTask } from "@/lib/backend-api/tasks";
import {
  resolveClarification,
  respondToClarificationAsClient,
} from "@/lib/backend-api/clarifications";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/backend-api/notifications";
import type { OpsCheckType } from "../contracts/case";
import type { OpsException } from "../contracts/operations";

const exceptionIndex = new Map<
  string,
  { caseId: string; type: "clarification" | "field"; version?: number }
>();

export function createApiOperationsRepository(_baseUrl: string): OperationsRepository {
  return {
    getDashboard: getOperationsWorkspaceDashboard,
    async getFacets() {
      const [clients, users] = await Promise.all([listClients(), listUsers()]);
      return {
        clients: clients.items.map((row) => ({ value: row.publicId, label: row.displayName })),
        owners: users.items.map((row) => ({ value: row.id, label: row.displayName })),
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
      const response = await listCases({
        search: query.search,
        clientId: query.clientId === "all" ? undefined : query.clientId,
        limit: 100,
      });
      let rows = response.items.map(baseCase);
      if (query.stage && query.stage !== "all")
        rows = rows.filter((row) => row.stage === query.stage);
      if (query.priority && query.priority !== "all")
        rows = rows.filter((row) => row.priority === query.priority);
      if (query.risk && query.risk !== "all") rows = rows.filter((row) => row.risk === query.risk);
      if (query.sla && query.sla !== "all") rows = rows.filter((row) => row.slaState === query.sla);
      if (query.unassigned) rows = rows.filter((row) => !row.verifier);
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
    async runCaseAction(input) {
      if (["assign_verifier", "reassign_verifier"].includes(input.action) && input.value) {
        const detail = await getCase(input.caseId);
        const check = detail.checks.find((item) => item.status !== "COMPLETED");
        if (!check) throw new Error("No open check is available for assignment");
        await createTask(check.publicId, { assigneeId: input.value, instructions: input.note });
        return { caseId: input.caseId, message: "Verifier assigned" };
      }
      throw new Error("This workflow action needs a dedicated backend endpoint");
    },
    async getAssignments() {
      const [cases, members] = await Promise.all([
        listCases({ limit: 100 }),
        listUsers("VERIFIER"),
      ]);
      return {
        items: cases.items.flatMap((row) =>
          row.checks
            .filter(
              (check) =>
                !(check.tasks ?? []).some((task) => task.assignee) && check.status !== "COMPLETED",
            )
            .map((check) => ({
              id: check.publicId,
              caseId: row.id,
              caseNumber: row.caseNumber,
              candidateName: row.subject.fullName,
              clientName: row.client.displayName,
              checkType: typeOf(check.type),
              checkLabel: check.type.replaceAll("_", " "),
              priority: priorityOf(row.priority),
              slaState: slaOf(check.dueAt ?? row.dueAt).state,
              slaMinutesRemaining: slaOf(check.dueAt ?? row.dueAt).minutes,
              branch: "Unassigned",
              city: "—",
              requestedAt: row.createdAt,
            })),
        ),
        members: members.items.map((member) => ({
          id: member.id,
          name: member.displayName,
          role: "Verifier",
          branch: member.branch?.name ?? "All branches",
          skills: [
            "identity",
            "address",
            "employment",
            "education",
            "criminal",
            "reference",
          ] as OpsCheckType[],
          activeCases: 0,
          activeChecks: 0,
          dueToday: 0,
          overdue: 0,
          completedToday: 0,
          averageTurnaroundMinutes: 0,
          capacity: "available" as const,
          capacityPercent: 0,
          availability: "available" as const,
        })),
      };
    },
    async assignCase(input) {
      const members = await listUsers("VERIFIER");
      const member = members.items.find((row) => row.id === input.memberId);
      await Promise.all(
        input.itemIds.map((checkId) =>
          createTask(checkId, { assigneeId: input.memberId, instructions: input.note }),
        ),
      );
      return {
        assigned: input.itemIds.length,
        memberName: member?.displayName ?? "Verifier",
        warnings: [],
      };
    },
    async reassignCase(input) {
      return this.assignCase(input);
    },
    async getExceptions(query) {
      const data = await getExceptionsDashboard();
      const rows: OpsException[] = [
        ...data.overdue.map((row) => ({
          id: row.id,
          type: "sla_overdue" as const,
          severity: row.priority === "URGENT" ? ("critical" as const) : ("high" as const),
          caseId: row.id,
          caseNumber: row.caseNumber,
          candidateName: row.subject.fullName,
          clientName: row.client.displayName,
          reason: "Case is past its committed due date",
          raisedAt: row.dueAt,
          ageMinutes: Math.max(0, Math.round((Date.now() - Date.parse(row.dueAt)) / 60_000)),
          slaImpact: "SLA breached",
          owner: "Operations",
          latestUpdate: row.createdAt,
          recommendedAction: "Review and escalate",
          status: "open" as const,
          resolutionNote: null,
        })),
        ...data.clarifications.map((row) => {
          exceptionIndex.set(row.id, { caseId: row.case.publicId, type: "clarification" });
          return {
            id: row.id,
            type: "client_clarification" as const,
            severity:
              row.dueAt && Date.parse(row.dueAt) < Date.now()
                ? ("high" as const)
                : ("medium" as const),
            caseId: row.case.publicId,
            caseNumber: row.case.caseNumber,
            candidateName: row.case.subject.fullName,
            clientName: row.case.client.displayName,
            reason: row.subject,
            raisedAt: row.createdAt,
            ageMinutes: Math.max(0, Math.round((Date.now() - Date.parse(row.createdAt)) / 60_000)),
            slaImpact: "Awaiting response",
            owner: "Operations",
            latestUpdate: row.latestMessage?.body ?? row.subject,
            recommendedAction: "Review clarification",
            status: row.status === "RESOLVED" ? ("resolved" as const) : ("open" as const),
            resolutionNote: null,
          };
        }),
        ...data.fieldVisits.map((row) => {
          exceptionIndex.set(row.id, {
            caseId: row.case.publicId,
            type: "field",
            version: row.version,
          });
          return {
            id: row.id,
            type: "field_visit" as const,
            severity: "high" as const,
            caseId: row.case.publicId,
            caseNumber: row.case.caseNumber,
            candidateName: row.case.subject.fullName,
            clientName: row.case.client.displayName,
            reason: `Field exception at ${row.address}`,
            raisedAt: row.createdAt,
            ageMinutes: Math.max(0, Math.round((Date.now() - Date.parse(row.createdAt)) / 60_000)),
            slaImpact: "Visit blocked",
            owner: row.assignee?.displayName ?? "Unassigned",
            latestUpdate: row.capturedAt ?? row.createdAt,
            recommendedAction: "Review field evidence",
            status: "open" as const,
            resolutionNote: null,
          };
        }),
      ];
      let filtered = rows.filter((row) => row.status === (query.status ?? "open"));
      if (query.search)
        filtered = filtered.filter((row) =>
          `${row.caseNumber} ${row.candidateName} ${row.clientName}`
            .toLowerCase()
            .includes(query.search!.toLowerCase()),
        );
      if (query.type && query.type !== "all")
        filtered = filtered.filter((row) => row.type === query.type);
      if (query.severity && query.severity !== "all")
        filtered = filtered.filter((row) => row.severity === query.severity);
      const page = query.page ?? 1,
        pageSize = query.pageSize ?? 10;
      return {
        rows: filtered.slice((page - 1) * pageSize, page * pageSize),
        total: filtered.length,
        page,
        pageSize,
        openCount: rows.filter((row) => row.status === "open").length,
        resolvedCount: rows.filter((row) => row.status === "resolved").length,
      };
    },
    async resolveException(id, note) {
      const item = exceptionIndex.get(id);
      if (!item) throw new Error("Refresh the exception queue and try again");
      if (item.type === "clarification") await resolveClarification(item.caseId, id, note);
      else
        throw new Error(
          "Field exception approval must be completed from the field evidence review",
        );
    },
    async escalateException() {
      throw new Error("Escalation endpoint is not available yet");
    },
    async assignExceptionOwner() {
      throw new Error("Exception ownership endpoint is not available yet");
    },
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
      if (query.search)
        rows = rows.filter((row) =>
          `${row.caseNumber} ${row.candidateName} ${row.subject}`
            .toLowerCase()
            .includes(query.search!.toLowerCase()),
        );
      if (query.state && query.state !== "all")
        rows = rows.filter((row) =>
          query.state === "overdue" ? row.overdue : row.state === query.state,
        );
      return rows;
    },
    async respondToClarification(input) {
      const data = await getExceptionsDashboard();
      const row = data.clarifications.find((item) => item.id === input.clarificationId);
      if (!row) throw new Error("Clarification not found");
      if (input.action === "resolve")
        await resolveClarification(row.case.publicId, row.id, input.note);
      else if (input.note)
        await respondToClarificationAsClient(row.case.publicId, row.id, input.note);
      else throw new Error("Add a note before submitting this action");
      return {
        clarificationId: row.id,
        state: input.action === "resolve" ? "resolved" : "under_review",
        message: "Clarification updated",
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
