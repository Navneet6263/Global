import { Building2, Mail, Phone, User, type LucideIcon } from "lucide-react";

import { priorities, type CaseDraft, type Priority } from "./model";
import type { ClientOption } from "@/lib/api/cases";

function Field({
  label,
  icon: Icon,
  ...props
}: { label: string; icon: LucideIcon } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="relative block">
        <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          {...props}
          className="h-11 w-full rounded-2xl bg-secondary/70 pl-10 pr-4 text-base outline-none transition placeholder:text-muted-foreground/70 focus:bg-secondary focus:ring-2 focus:ring-ring/30 sm:text-sm"
        />
      </span>
    </label>
  );
}

export function CandidateStep({
  draft,
  onChange,
  clients,
  clientsLoading,
}: {
  draft: CaseDraft;
  onChange: (patch: Partial<CaseDraft>) => void;
  clients: ClientOption[];
  clientsLoading: boolean;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field
        label="Candidate name"
        icon={User}
        autoComplete="name"
        placeholder="e.g. Rahul Mehra"
        value={draft.candidate}
        onChange={(event) => onChange({ candidate: event.target.value })}
      />
      <label className="block">
        <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Client / employer
        </span>
        <span className="relative block">
          <Building2 className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <select
            value={draft.clientId}
            disabled={clientsLoading}
            onChange={(event) => {
              const client = clients.find((option) => option.publicId === event.target.value);
              onChange({ clientId: event.target.value, client: client?.displayName ?? "" });
            }}
            className="h-11 w-full appearance-none rounded-2xl bg-secondary/70 pl-10 pr-4 text-base outline-none transition focus:bg-secondary focus:ring-2 focus:ring-ring/30 disabled:opacity-60 sm:text-sm"
          >
            <option value="">{clientsLoading ? "Loading clients…" : "Choose a client"}</option>
            {clients.map((client) => (
              <option key={client.publicId} value={client.publicId}>
                {client.displayName} · {client.code}
              </option>
            ))}
          </select>
        </span>
      </label>
      <Field
        label="Email"
        icon={Mail}
        type="email"
        autoComplete="email"
        placeholder="candidate@company.com"
        value={draft.email}
        onChange={(event) => onChange({ email: event.target.value })}
      />
      <Field
        label="Mobile"
        icon={Phone}
        inputMode="tel"
        autoComplete="tel"
        placeholder="+91 98xxx xxxxx"
        value={draft.phone}
        onChange={(event) => onChange({ phone: event.target.value })}
      />
      <div className="sm:col-span-2">
        <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Priority
        </span>
        <div className="flex flex-wrap gap-2">
          {priorities.map((priority) => (
            <button
              key={priority}
              type="button"
              onClick={() => onChange({ priority: priority as Priority })}
              className={`h-9 rounded-full px-4 text-xs font-medium transition-colors ${
                draft.priority === priority
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {priority}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
