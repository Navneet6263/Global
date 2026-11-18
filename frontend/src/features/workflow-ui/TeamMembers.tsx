import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ListChecks, PauseCircle, ShieldCheck, UserPlus, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  EmptyState,
  LoadingState,
  Panel,
  SearchField,
  SegmentTabs,
  StatCard,
  StatGrid,
} from "@/components/workspace/kit";
import { ExportSheetButton, type SheetColumn } from "@/components/workspace/export-sheet";
import { humanizeCode, istText } from "@/components/workspace/format";
import {
  TemporaryPasswordDialog,
  type TemporaryPasswordReceipt,
} from "@/features/users/components/temporary-password-dialog";
import { getTeamMembers, type TeamMember } from "@/lib/backend-api/team-members";
import { useVerifierDepartment } from "@/lib/auth/verifier-department";
import { visibleTeamsFor } from "./team-members-scope";
import { TeamMemberRow } from "./TeamMemberRow";
import { AddMemberDialog } from "./AddMemberDialog";

type StatusView = "all" | "ACTIVE" | "SUSPENDED";

const EXPORT_COLUMNS: readonly SheetColumn<TeamMember>[] = [
  { key: "name", label: "Name", value: (m) => m.name },
  { key: "email", label: "Email", value: (m) => m.email },
  { key: "phone", label: "Phone", value: (m) => m.phone },
  { key: "team", label: "Team", value: (m) => m.team.name },
  {
    key: "teamRole",
    label: "Team role",
    value: (m) => (m.teamRole === "LEAD" ? "Team Leader" : "Member"),
  },
  { key: "status", label: "Status", value: (m) => humanizeCode(m.status) },
  { key: "access", label: "Access", value: (m) => (m.customAccess ? "Custom" : "Full") },
  { key: "openWork", label: "Open work", value: (m) => m.openWork },
  { key: "doneThisWeek", label: "Done (7 days)", value: (m) => m.doneThisWeek },
  { key: "lastLoginAt", label: "Last sign-in", value: (m) => istText(m.lastLoginAt) },
  { key: "createdAt", label: "Added", value: (m) => istText(m.createdAt) },
];
const EXPORT_DEFAULTS = ["name", "email", "team", "status", "openWork", "doneThisWeek"];

/** Team Leader: the people in its teams; add a login, suspend, reset a password. */
export function TeamMembers({ workspace }: { workspace: "verifier" | "data-entry" }) {
  const queryClient = useQueryClient();
  const { departmentId } = useVerifierDepartment();
  const overview = useQuery({
    queryKey: ["workflow", "team-members"],
    queryFn: ({ signal }) => getTeamMembers(signal),
  });
  const [status, setStatus] = useState<StatusView>("all");
  const [teamId, setTeamId] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [receipt, setReceipt] = useState<TemporaryPasswordReceipt | null>(null);

  const data = useMemo(() => {
    const raw = overview.data;
    if (!raw) return undefined;
    const teams = visibleTeamsFor(raw.teams, workspace, departmentId);
    const ids = new Set(teams.map((team) => team.id));
    return { ...raw, teams, members: raw.members.filter((member) => ids.has(member.team.id)) };
  }, [overview.data, workspace, departmentId]);

  const members = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (data?.members ?? []).filter(
      (member) =>
        (status === "all" || member.status === status) &&
        (teamId === "all" || member.team.id === teamId) &&
        (!term ||
          `${member.name} ${member.email} ${member.phone ?? ""}`.toLowerCase().includes(term)),
    );
  }, [data, status, teamId, search]);

  const all = data?.members ?? [];
  const active = all.filter((m) => m.status === "ACTIVE").length;
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["workflow"] });

  return (
    <div className="grid gap-4">
      <StatGrid label="Team at a glance">
        <StatCard
          icon={UsersRound}
          tone="info"
          label="People"
          value={data ? all.length : "—"}
          hint={
            data?.teams.length === 1
              ? `${data.teams[0]!.name} team`
              : `${data?.teams.length ?? 0} teams you lead`
          }
        />
        <StatCard
          icon={ShieldCheck}
          tone="good"
          label="Active"
          value={data ? active : "—"}
          hint="Can sign in"
        />
        <StatCard
          icon={PauseCircle}
          tone={all.length - active ? "warn" : "neutral"}
          label="Suspended"
          value={data ? all.length - active : "—"}
          hint="Sign-in blocked"
        />
        <StatCard
          icon={ListChecks}
          tone="violet"
          label="Open work"
          value={data ? all.reduce((sum, m) => sum + m.openWork, 0) : "—"}
          hint={
            data ? `${all.reduce((sum, m) => sum + m.doneThisWeek, 0)} done in 7 days` : undefined
          }
        />
      </StatGrid>

      <Panel
        label="Team members"
        title="People in your team"
        count={members.length}
        description="Add a login for a new member, reset a password or suspend access. Everything is recorded."
        actions={
          <>
            <ExportSheetButton
              source="team-members"
              title="Export team members"
              filename="Sapling-Global-team-members"
              columns={EXPORT_COLUMNS}
              defaults={EXPORT_DEFAULTS}
              scopeNote="the people shown"
              disabled={!members.length}
              loadRows={() => Promise.resolve(members)}
            />
            <Button type="button" onClick={() => setAdding(true)} disabled={!data?.teams.length}>
              <UserPlus aria-hidden /> Add member
            </Button>
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-3 px-5 pb-3">
          <SegmentTabs
            label="Status"
            value={status}
            onChange={setStatus}
            options={[
              { id: "all", label: "All", count: all.length },
              { id: "ACTIVE", label: "Active", count: active },
              { id: "SUSPENDED", label: "Suspended", count: all.length - active },
            ]}
          />
          {data && data.teams.length > 1 ? (
            <select
              aria-label="Team"
              value={teamId}
              onChange={(event) => setTeamId(event.target.value)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-700"
            >
              <option value="all">All teams</option>
              {data.teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          ) : null}
          <SearchField
            className="min-w-56 flex-1"
            value={search}
            onChange={setSearch}
            placeholder="Search name, email or phone"
            label="Search team members"
          />
        </div>

        {overview.isError ? (
          <EmptyState tone="bad" title="Team unavailable" detail={overview.error.message} />
        ) : !data ? (
          <LoadingState label="Loading your team" />
        ) : !members.length ? (
          <EmptyState
            icon={UsersRound}
            tone="neutral"
            title={all.length ? "Nobody matches" : "No members yet"}
            detail={all.length ? "Try another filter." : "Add the first member of your team."}
            action={
              all.length ? undefined : (
                <Button onClick={() => setAdding(true)}>
                  <UserPlus aria-hidden /> Add member
                </Button>
              )
            }
          />
        ) : (
          <ul aria-label="Members" className="divide-y divide-slate-100 border-t border-slate-100">
            {members.map((member) => (
              <TeamMemberRow
                key={`${member.team.id}:${member.id}`}
                member={member}
                onReceipt={setReceipt}
                onChanged={refresh}
              />
            ))}
          </ul>
        )}
      </Panel>

      {adding && data ? (
        <AddMemberDialog
          data={data}
          onClose={() => setAdding(false)}
          onCreated={(next) => {
            setAdding(false);
            setReceipt(next);
            void refresh();
          }}
        />
      ) : null}
      <TemporaryPasswordDialog receipt={receipt} onClose={() => setReceipt(null)} />
    </div>
  );
}
