import { KeyRound, PauseCircle, PlayCircle } from "lucide-react";
import { StatusBadge } from "@/components/feedback/status-badge";
import { Button } from "@/components/ui/button";
import { OversightEmpty } from "@/features/admin-dashboard/components/oversight-ui";
import { formatDateTime } from "@/lib/formatting";
import type { TeamMember, VendorTeamOverview } from "./vendor-team-contracts";
import { memberActions, memberStatus } from "./vendor-team-model";

const HEADERS = ["Team user", "Status", "Pending requests", "Last sign-in", "Actions"];

/** The Main Vendor's team, with only the actions the server allows for each row. */
export function VendorTeamTable({
  team,
  busyId,
  onSuspend,
  onReactivate,
  onReset,
}: {
  team: VendorTeamOverview;
  busyId: string | null;
  onSuspend: (member: TeamMember) => void;
  onReactivate: (member: TeamMember) => void;
  onReset: (member: TeamMember) => void;
}) {
  if (!team.members.length)
    return (
      <OversightEmpty
        title="No team users yet"
        detail="Create a team user ID to share the work assigned to you."
      />
    );
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-left text-xs">
        <thead className="bg-muted/35 text-[10px] tracking-[0.1em] text-muted-foreground uppercase">
          <tr>
            {HEADERS.map((header) => (
              <th key={header} scope="col" className="px-4 py-3 font-semibold">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/70">
          {team.members.map((member) => {
            const status = memberStatus(member);
            const actions = memberActions(member, team);
            const busy = busyId === member.id;
            return (
              <tr key={member.id}>
                <td className="px-4 py-3">
                  <p className="font-semibold text-foreground">{member.name}</p>
                  <p className="text-[10px] text-muted-foreground">{member.email}</p>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge label={status.label} tone={status.tone} />
                </td>
                <td className="px-4 py-3">{member.pendingRequests}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {member.lastLoginAt ? formatDateTime(member.lastLoginAt) : "Never"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    {actions.canSuspend ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => onSuspend(member)}
                      >
                        <PauseCircle className="size-3.5" aria-hidden /> Suspend
                      </Button>
                    ) : null}
                    {member.status === "SUSPENDED" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy || !actions.canReactivate}
                        title={
                          actions.canReactivate ? undefined : "No free slot in your team limit"
                        }
                        onClick={() => onReactivate(member)}
                      >
                        <PlayCircle className="size-3.5" aria-hidden /> Reactivate
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => onReset(member)}
                    >
                      <KeyRound className="size-3.5" aria-hidden /> Reset password
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
