import { UsersRound } from "lucide-react";
import { SegmentTabs } from "@/components/workspace/kit";
import { permissionLabel } from "@/features/users/role-guide";
import type { TeamMembersOverview } from "@/lib/backend-api/team-members";
import { cn } from "@/lib/utils";

export function AddMemberAccessStep({
  data,
  teamId,
  onTeamChange,
  fullAccess,
  onFullAccessChange,
  ticked,
  onTickedChange,
}: {
  data: TeamMembersOverview;
  teamId: string;
  onTeamChange: (id: string) => void;
  fullAccess: boolean;
  onFullAccessChange: (full: boolean) => void;
  ticked: string[];
  onTickedChange: React.Dispatch<React.SetStateAction<string[]>>;
}) {
  const team = data.teams.find((t) => t.id === teamId);
  const role = data.roles.find((r) => r.code === team?.memberRole);
  const allPermissions = role?.permissions ?? [];

  return (
    <div className="grid gap-5">
      <fieldset className="grid gap-2">
        <legend className="mb-2 text-[13px] font-semibold text-slate-800">Team</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {data.teams.map((option) => (
            <label
              key={option.id}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-xl border p-3",
                teamId === option.id
                  ? "border-blue-400 bg-blue-50 ring-2 ring-blue-500/20"
                  : "border-slate-200 hover:bg-slate-50",
              )}
            >
              <input
                type="radio"
                name="team"
                className="sr-only"
                checked={teamId === option.id}
                onChange={() => {
                  onTeamChange(option.id);
                  onTickedChange([]);
                }}
              />
              <UsersRound className="size-4 text-blue-600" aria-hidden />
              <span>
                <strong className="block text-[13.5px] text-slate-900">{option.name}</strong>
                <small className="text-[12px] text-slate-500">
                  Login as {option.memberRole === "VERIFIER" ? "Verifier" : "Data Entry"}
                </small>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="grid gap-2">
        <legend className="mb-2 text-[13px] font-semibold text-slate-800">Access</legend>
        <SegmentTabs
          label="Access level"
          value={fullAccess ? "full" : "custom"}
          onChange={(value) => {
            onFullAccessChange(value === "full");
            if (value === "custom" && !ticked.length) onTickedChange(allPermissions);
          }}
          options={[
            { id: "full", label: "Full access" },
            { id: "custom", label: "Customise" },
          ]}
        />
        {fullAccess ? (
          <p className="text-[12.5px] text-slate-500">
            Everything a {role?.name ?? "team member"} can do ({allPermissions.length} permissions).
            Right for most people.
          </p>
        ) : (
          <div className="grid gap-1.5 sm:grid-cols-2" role="group" aria-label="Permissions">
            {allPermissions.map((permission) => {
              const on = ticked.includes(permission);
              return (
                <label
                  key={permission}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-[12.5px]",
                    on
                      ? "border-blue-200 bg-blue-50 text-slate-800"
                      : "border-slate-200 text-slate-500",
                  )}
                >
                  <input
                    type="checkbox"
                    className="size-4 accent-blue-600"
                    checked={on}
                    aria-label={permissionLabel(permission)}
                    onChange={() =>
                      onTickedChange((current) =>
                        on ? current.filter((v) => v !== permission) : [...current, permission],
                      )
                    }
                  />
                  {permissionLabel(permission)}
                </label>
              );
            })}
            {!ticked.length ? (
              <p className="text-[12px] text-red-600 sm:col-span-2">
                Keep at least one permission.
              </p>
            ) : null}
          </div>
        )}
      </fieldset>
    </div>
  );
}
