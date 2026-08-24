import { Check } from "lucide-react";

import { checkCatalog, packages, type CaseDraft, type CheckKey } from "./model";

export function ChecksStep({
  draft,
  onChange,
}: {
  draft: CaseDraft;
  onChange: (patch: Partial<CaseDraft>) => void;
}) {
  const toggleCheck = (key: CheckKey) =>
    onChange({
      checks: draft.checks.includes(key)
        ? draft.checks.filter((check) => check !== key)
        : [...draft.checks, key],
    });

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-3">
        {packages.map((item) => (
          <button
            key={item.name}
            type="button"
            onClick={() => onChange({ packageName: item.name, checks: [...item.checks] })}
            className={`rounded-2xl p-3 text-left transition-colors ${
              draft.packageName === item.name
                ? "bg-accent text-accent-foreground"
                : "bg-secondary/70 hover:bg-secondary"
            }`}
          >
            <p className="text-sm font-semibold">{item.name}</p>
            <p className="mt-0.5 text-[11px] opacity-70">{item.blurb}</p>
          </button>
        ))}
      </div>

      <div>
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Checks included ({draft.checks.length})
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {checkCatalog.map((item) => {
            const selected = draft.checks.includes(item.key);
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => toggleCheck(item.key)}
                className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors ${
                  selected ? "bg-secondary" : "bg-secondary/40 hover:bg-secondary/70"
                }`}
              >
                <span
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${
                    selected ? "bg-accent text-accent-foreground" : "bg-card text-muted-foreground"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{item.label}</span>
                  <span className="block text-[11px] text-muted-foreground">
                    average TAT {item.tatDays}d
                  </span>
                </span>
                <span
                  className={`grid h-5 w-5 place-items-center rounded-full ${
                    selected ? "bg-primary text-primary-foreground" : "bg-card"
                  }`}
                >
                  {selected && <Check className="h-3 w-3" />}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
