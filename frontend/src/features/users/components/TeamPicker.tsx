import type { TeamChoice, TeamOption } from "./team-choice";

export type { TeamChoice, TeamOption } from "./team-choice";

/**
 * Tick the teams a person works in, and Team Leader per team. Used by Create user ID and
 * Edit role & access so an existing person can be made a Team Leader too.
 */
export function TeamPicker({
  options,
  value,
  onChange,
  loading,
}: {
  options: readonly TeamOption[];
  value: TeamChoice;
  onChange: (next: TeamChoice) => void;
  loading?: boolean;
}) {
  if (loading) return <p className="cu-muted">Loading teams…</p>;
  if (!options.length)
    return (
      <p className="cu-muted">
        No matching team yet. Create one in Departments &amp; teams, then add them.
      </p>
    );
  return (
    <div className="cu-teams">
      {options.map((team) => {
        const chosen = value[team.id];
        return (
          <div key={team.id} className="cu-team" data-on={Boolean(chosen)}>
            <label>
              <input
                type="checkbox"
                checked={Boolean(chosen)}
                onChange={(event) => {
                  const copy = { ...value };
                  if (event.target.checked) copy[team.id] = { lead: false };
                  else delete copy[team.id];
                  onChange(copy);
                }}
                aria-label={`Team ${team.name}`}
              />
              <span>
                <strong>{team.name}</strong>
                <small>
                  {team.kind === "DATA_ENTRY" ? "Data Entry team" : "Verification team"}
                </small>
              </span>
            </label>
            {chosen ? (
              <label className="cu-lead">
                <input
                  type="checkbox"
                  checked={chosen.lead}
                  onChange={(event) =>
                    onChange({ ...value, [team.id]: { lead: event.target.checked } })
                  }
                  aria-label={`Team Leader of ${team.name}`}
                />
                Team Leader
              </label>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
