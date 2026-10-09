import { useId, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Search } from "lucide-react";
import { getSession } from "@/lib/api/auth";

const clientDestinations: readonly WorkspaceDestination[] = [
  {
    label: "Overview",
    detail: "Portfolio and current workload",
    to: "/client-portal",
    terms: "dashboard home status",
    permission: "case:read",
  },
  {
    label: "Your verifications",
    detail: "Find and track a candidate case",
    to: "/client-portal/verifications",
    terms: "candidate case track checks",
    permission: "case:read",
  },
  {
    label: "Needs your action",
    detail: "Document replacements and clarification requests",
    to: "/client-portal/actions",
    terms: "pending rejected document upload consent",
    permission: "case:read",
  },
  {
    label: "Published reports",
    detail: "Download released verification reports",
    to: "/client-portal/reports",
    terms: "report pdf download final",
    permission: "report:read",
  },
  {
    label: "Customise export",
    detail: "Choose data, filters and column order",
    to: "/client-portal/reports",
    view: "custom",
    terms: "report csv excel expenses export columns",
    permission: "case:read",
  },
  {
    label: "Invoice downloads",
    detail: "Invoice PDFs and monthly statements",
    to: "/client-portal/reports",
    view: "invoices",
    terms: "bill invoice statement download",
    permission: "case:read",
  },
  {
    label: "Insights",
    detail: "Workflow, quality and branch comparisons",
    to: "/client-portal/analytics",
    terms: "analytics rejection chart performance",
    permission: "case:read",
  },
  {
    label: "Invoices & payments",
    detail: "Balance, charges and payment history",
    to: "/client-portal/billing",
    terms: "money fee cost price finance due",
    permission: "case:read",
  },
  {
    label: "Queries & support",
    detail: "Ask a question or follow up a request",
    to: "/client-portal/support",
    terms: "help rm contact issue ticket",
    permission: "support:request",
  },
];

export interface WorkspaceDestination {
  label: string;
  detail: string;
  to: string;
  view?: string;
  search?: Record<string, string | boolean>;
  terms: string;
  permission: string;
}

export function ClientWorkspaceSearch({
  destinations = clientDestinations,
  caseSearchTo = "/client-portal/verifications",
  placeholder = "Search features or cases…",
}: {
  destinations?: readonly WorkspaceDestination[];
  caseSearchTo?: string;
  placeholder?: string;
} = {}) {
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const id = useId();
  const navigate = useNavigate();
  const session = useQuery({ queryKey: ["session"], queryFn: getSession, staleTime: 60_000 });
  const allowed = (permission: string) =>
    session.data?.permissions.some((value) => value === "*" || value === permission);
  const results = destinations.filter(
    (item) =>
      allowed(item.permission) &&
      `${item.label} ${item.detail} ${item.terms}`
        .toLowerCase()
        .includes(term.trim().toLowerCase()),
  );
  const options = [
    ...results.map((item) => ({
      label: item.label,
      detail: item.detail,
      to: item.to,
      search: item.search ?? (item.view ? { view: item.view } : {}),
    })),
    ...(term.trim() && allowed("case:read")
      ? [
          {
            label: `Search cases for “${term.trim()}”`,
            detail: "Search candidate name or case number",
            to: caseSearchTo,
            search: { q: term.trim() },
          },
        ]
      : []),
  ];
  const select = (index: number) => {
    const option = options[index];
    if (!option) return;
    setOpen(false);
    setTerm("");
    setActive(-1);
    void navigate({ to: option.to, search: option.search });
  };
  return (
    <div
      className="relative"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <Search
        className="pointer-events-none absolute left-3 top-3 size-4 text-slate-400"
        aria-hidden
      />
      <input
        role="combobox"
        aria-label="Search features or cases"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={id}
        aria-activedescendant={active >= 0 && options[active] ? `${id}-${active}` : undefined}
        autoComplete="off"
        maxLength={120}
        value={term}
        placeholder={placeholder}
        className="w-full border border-slate-200 py-2 pl-9 pr-3 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setTerm(event.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false);
            setActive(-1);
          }
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
            setActive((value) =>
              Math.max(
                0,
                Math.min(options.length - 1, value + (event.key === "ArrowDown" ? 1 : -1)),
              ),
            );
          }
          if (event.key === "Enter") {
            event.preventDefault();
            select(active >= 0 ? active : results.length ? 0 : options.length - 1);
          }
        }}
      />
      {open && (
        <div className="absolute left-0 right-0 top-full z-40 mt-2 min-w-[230px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <p className="border-b border-slate-100 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Go to a feature or find a case
          </p>
          <div
            id={id}
            role="listbox"
            aria-label="Search results"
            className="max-h-80 overflow-y-auto p-1"
          >
            {options.map((option, index) => (
              <button
                id={`${id}-${index}`}
                key={`${option.to}-${option.label}`}
                role="option"
                aria-selected={active === index}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => select(index)}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left hover:bg-blue-50 ${active === index ? "bg-blue-50" : ""}`}
              >
                <span className="min-w-0 flex-1">
                  <strong className="block text-xs font-semibold text-slate-800">
                    {option.label}
                  </strong>
                  <span className="mt-0.5 block text-[11px] text-slate-500">{option.detail}</span>
                </span>
                <ArrowUpRight className="size-3.5 shrink-0 text-blue-600" />
              </button>
            ))}
            {!options.length && (
              <p className="p-3 text-xs text-slate-500">No matching features available.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
