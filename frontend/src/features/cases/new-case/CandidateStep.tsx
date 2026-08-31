import { Building2, Mail, Phone, User, type LucideIcon } from "lucide-react";

import { priorities, type CaseDraft, type Priority } from "./model";
import type { ClientOption } from "@/lib/api/cases";
import { indianMobileDigits } from "@/lib/indian-mobile";

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
  clientsError,
  onRetryClients,
  fixedClient,
}: {
  draft: CaseDraft;
  onChange: (patch: Partial<CaseDraft>) => void;
  clients: ClientOption[];
  clientsLoading: boolean;
  clientsError: string | undefined;
  onRetryClients: () => void;
  fixedClient?: { publicId: string; displayName: string };
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
          Requesting organisation
        </span>
        {fixedClient ? (
          <span className="flex min-h-11 items-center gap-3 rounded-2xl border border-orange-100 bg-orange-50/70 px-3.5 py-2.5">
            <Building2 className="h-4 w-4 shrink-0 text-orange-600" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-foreground">
                {fixedClient.displayName}
              </span>
              <span className="block text-[10px] text-muted-foreground">
                Assigned client workspace
              </span>
            </span>
          </span>
        ) : (
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
            {clientsError ? (
              <span className="mt-1.5 block text-[10px] text-critical-foreground">
                Client list could not be loaded.{" "}
                <button type="button" className="font-semibold underline" onClick={onRetryClients}>
                  Retry
                </button>
              </span>
            ) : null}
          </span>
        )}
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
      <label className="block">
        <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Mobile
        </span>
        <span className="relative flex h-11 overflow-hidden rounded-2xl bg-secondary/70 transition focus-within:bg-secondary focus-within:ring-2 focus-within:ring-ring/30">
          <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <span className="flex items-center border-r border-border/70 pl-10 pr-3 text-sm font-semibold text-foreground">
            +91
          </span>
          <input
            inputMode="numeric"
            autoComplete="tel-national"
            pattern="[6-9][0-9]{9}"
            maxLength={10}
            placeholder="10-digit mobile"
            value={draft.phone}
            onChange={(event) => onChange({ phone: indianMobileDigits(event.target.value) })}
            className="min-w-0 flex-1 bg-transparent px-3 text-base outline-none placeholder:text-muted-foreground/70 sm:text-sm"
          />
        </span>
      </label>
      <p className="sm:col-span-2 -mt-1 text-[10px] leading-4 text-muted-foreground">
        Provide at least one verified contact channel. Consent OTP and the secure link are sent to
        the mobile number first, or to email when mobile is not supplied.
      </p>
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
