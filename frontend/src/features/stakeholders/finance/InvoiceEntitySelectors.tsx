import { useDeferredValue, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { listCases, listClients } from "@/lib/api/cases";

interface SelectionProps {
  value: string;
  label: string;
  onChange: (id: string, label: string) => void;
}

export function InvoiceClientSearch({ value, label, onChange }: SelectionProps) {
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim());
  const clients = useQuery({
    queryKey: ["clients", "invoice-search", deferredSearch],
    queryFn: () => listClients({ search: deferredSearch || undefined, limit: 25 }),
  });
  return (
    <label>
      <span className="mb-1.5 block text-xs font-semibold text-foreground">Client</span>
      <input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search client"
        className={inputClass}
      />
      <select
        value={value}
        onChange={(event) => {
          const item = clients.data?.items.find((row) => row.publicId === event.target.value);
          onChange(event.target.value, item?.displayName ?? "");
        }}
        className={`${inputClass} mt-2`}
      >
        <option value="">Select client</option>
        {value && !clients.data?.items.some((row) => row.publicId === value) ? (
          <option value={value}>{label}</option>
        ) : null}
        {clients.data?.items.map((client) => (
          <option key={client.publicId} value={client.publicId}>
            {client.displayName}
          </option>
        ))}
      </select>
    </label>
  );
}

export function InvoiceCaseSearch({
  clientId,
  value,
  label,
  onChange,
}: SelectionProps & { clientId: string }) {
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim());
  const cases = useQuery({
    queryKey: ["cases", "invoice-search", clientId, deferredSearch],
    queryFn: () => listCases({ clientId, search: deferredSearch || undefined, limit: 25 }),
    enabled: Boolean(clientId),
  });
  return (
    <div className="space-y-1.5">
      <input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Find case"
        aria-label="Search case number or candidate"
        className={lineClass}
      />
      <select
        value={value}
        onChange={(event) => {
          const item = cases.data?.items.find((row) => row.id === event.target.value);
          onChange(event.target.value, item?.caseNumber ?? "");
        }}
        disabled={!clientId}
        aria-label="Link invoice line to case"
        className={lineClass}
      >
        <option value="">No case link</option>
        {value && !cases.data?.items.some((row) => row.id === value) ? (
          <option value={value}>{label}</option>
        ) : null}
        {cases.data?.items.map((item) => (
          <option key={item.id} value={item.id}>
            {item.caseNumber}
          </option>
        ))}
      </select>
    </div>
  );
}

const inputClass =
  "h-11 w-full rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-primary/45 focus:ring-4 focus:ring-primary/8";
const lineClass =
  "h-10 w-full min-w-0 rounded-xl border border-border bg-card px-2 text-xs text-foreground outline-none focus:border-primary/45 focus:ring-4 focus:ring-primary/8 disabled:opacity-50";
