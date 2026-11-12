import { Avatar, Panel } from "@/components/workspace/kit";
import { cn } from "@/lib/utils";
import type { TeamQueue } from "@/lib/backend-api/workflow";

type TeamMember = TeamQueue["members"][number];

const HOW_IT_WORKS_STEPS = [
  ["Take it", "Verify a check yourself. It moves to your Active queue."],
  ["Assign", "Give it to a member. The least-loaded person is shown first."],
  ["Reassign", "Move work that is waiting or blocked to someone else."],
] as const;

export function TeamQueueSidebar({
  members,
  me,
  maxLoad,
}: {
  members: TeamMember[];
  me?: string;
  maxLoad: number;
}) {
  return (
    <aside className="grid gap-4">
      <Panel title="Team load" label="Team members" count={members.length}>
        {members.length ? (
          <ul className="grid gap-3 px-5 pb-5">
            {members.map((member) => (
              <li key={`${member.department.id}:${member.id}`} className="flex items-center gap-3">
                <Avatar name={member.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2 text-[13px]">
                    <span className="truncate font-semibold text-slate-800">
                      {member.name}
                      {member.id === me ? " (you)" : ""}
                    </span>
                    <span className="tabular-nums font-bold text-slate-900">{member.openWork}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <span
                      className={cn(
                        "block h-full rounded-full",
                        member.openWork / maxLoad > 0.75 ? "bg-amber-500" : "bg-blue-500",
                      )}
                      style={{ width: `${(member.openWork / maxLoad) * 100}%` }}
                    />
                  </div>
                  <small className="text-[11px] text-slate-400">
                    {member.department.name}
                    {member.role === "LEAD" ? " · Team Leader" : ""} · open checks
                  </small>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 pb-5 text-[13px] text-slate-500">
            No members yet. Operations adds them in Departments &amp; teams.
          </p>
        )}
      </Panel>
      <Panel title="How it works" label="How the team queue works">
        <ol className="grid gap-2 px-5 pb-5 text-[12.5px] text-slate-600">
          {HOW_IT_WORKS_STEPS.map(([title, detail], index) => (
            <li key={title} className="flex gap-3 rounded-xl bg-slate-50 p-3">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-white text-[11px] font-bold text-blue-700 ring-1 ring-blue-100">
                {index + 1}
              </span>
              <span>
                <strong className="block text-slate-800">{title}</strong>
                {detail}
              </span>
            </li>
          ))}
        </ol>
      </Panel>
    </aside>
  );
}
