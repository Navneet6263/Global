import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { FileText, KeyRound, MoreHorizontal, PauseCircle, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, Pill } from "@/components/workspace/kit";
import { humanizeCode, istText } from "@/components/workspace/format";
import { temporaryPassword } from "@/lib/auth/temporary-password";
import {
  resetTeamMemberPassword,
  setTeamMemberStatus,
  type TeamMember,
} from "@/lib/backend-api/team-members";
import type { TemporaryPasswordReceipt } from "@/features/users/components/temporary-password-dialog";
import { TeamMemberDocumentsDialog } from "./TeamMemberDocumentsDialog";
import { cn } from "@/lib/utils";

export function TeamMemberRow({
  member,
  onReceipt,
  onChanged,
}: {
  member: TeamMember;
  onReceipt: (receipt: TemporaryPasswordReceipt) => void;
  onChanged: () => Promise<unknown>;
}) {
  const [docsOpen, setDocsOpen] = useState(false);
  const suspended = member.status === "SUSPENDED";
  const toggle = useMutation({
    mutationFn: () =>
      setTeamMemberStatus(member.id, {
        status: suspended ? "ACTIVE" : "SUSPENDED",
        version: member.version,
      }),
    onSuccess: async (result) => {
      toast.success(
        suspended ? `${member.name} can sign in again` : `${member.name} is suspended`,
        {
          description:
            !suspended && result.openWork
              ? `${result.openWork} open check${result.openWork === 1 ? "" : "s"} still with them: reassign from the Team queue.`
              : undefined,
        },
      );
      await onChanged();
    },
    onError: (error: Error) => toast.error("Not changed", { description: error.message }),
  });

  const reset = useMutation({
    mutationFn: async () => {
      const password = temporaryPassword();
      const result = await resetTeamMemberPassword(member.id, password);
      return { password, emailed: result.emailed === true };
    },
    onSuccess: ({ password, emailed }) =>
      onReceipt({ kind: "reset", fullName: member.name, email: member.email, password, emailed }),
    onError: (error: Error) => toast.error("Password not reset", { description: error.message }),
  });

  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-5 py-3.5 transition hover:bg-slate-50 lg:grid-cols-[minmax(220px,1.4fr)_minmax(150px,1fr)_110px_120px_150px_40px]">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar name={member.name} tone={suspended ? "neutral" : "info"} />
        <div className="min-w-0">
          <strong
            className={cn(
              "block truncate text-[13.5px] font-semibold",
              suspended ? "text-slate-400" : "text-slate-900",
            )}
          >
            {member.name}
            {member.isYou ? " (you)" : ""}
          </strong>
          <small className="block truncate text-[11.5px] text-slate-500">
            {member.email}
            {member.phone ? ` · ${member.phone}` : ""}
          </small>
        </div>
      </div>
      <div className="col-span-2 flex flex-wrap items-center gap-1 lg:col-span-1">
        <Pill tone="info" dot={false}>
          {member.team.name}
        </Pill>
        {member.teamRole === "LEAD" ? (
          <Pill tone="violet" dot={false}>
            Team Leader
          </Pill>
        ) : null}
        {member.customAccess ? (
          <Pill tone="warn" dot={false}>
            Custom access
          </Pill>
        ) : null}
      </div>
      <Pill
        tone={suspended ? "warn" : "good"}
        className="col-start-2 row-start-1 justify-self-end lg:col-start-auto lg:row-start-auto lg:justify-self-start"
      >
        {humanizeCode(member.status)}
      </Pill>
      <div className="hidden text-[12.5px] text-slate-600 lg:block">
        <strong className="tabular-nums text-slate-900">{member.openWork}</strong> open
        <small className="block text-[11.5px] text-slate-400">
          {member.doneThisWeek} done · 7 days
        </small>
      </div>
      <div className="hidden text-[12px] text-slate-500 lg:block">
        {member.lastLoginAt ? `Signed in ${istText(member.lastLoginAt)}` : "Never signed in"}
      </div>
      <div className="col-start-2 row-start-2 justify-self-end lg:col-start-auto lg:row-start-auto">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Actions for ${member.name}`}
              disabled={!member.canManage}
            >
              <MoreHorizontal aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>{member.name}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setDocsOpen(true)}>
              <FileText aria-hidden /> View documents
            </DropdownMenuItem>
            <DropdownMenuItem disabled={reset.isPending} onSelect={() => reset.mutate()}>
              <KeyRound aria-hidden /> Reset password
            </DropdownMenuItem>
            <DropdownMenuItem disabled={toggle.isPending} onSelect={() => toggle.mutate()}>
              {suspended ? <PlayCircle aria-hidden /> : <PauseCircle aria-hidden />}
              {suspended ? "Reactivate" : "Suspend"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {docsOpen ? (
          <TeamMemberDocumentsDialog member={member} onClose={() => setDocsOpen(false)} />
        ) : null}
      </div>
    </li>
  );
}
