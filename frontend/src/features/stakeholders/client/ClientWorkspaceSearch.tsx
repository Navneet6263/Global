import { useEffect, useId, useRef, useState } from "react";
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
    label: "All candidates",
    detail: "Find, track and download every case",
    to: "/client-portal/verifications",
    terms: "candidate case track checks",
    permission: "case:read",
  },
  {
    label: "Your to-do",
    detail: "Documents to replace and questions to answer",
    to: "/client-portal/actions",
    terms: "pending rejected document upload consent action urgent",
    permission: "case:read",
  },
  {
    label: "Pipeline",
    detail: "Every case by stage, and what is waiting",
    to: "/client-portal/pipeline",
    terms: "board kanban stuck stage waiting progress",
    permission: "case:read",
  },
  {
    label: "Final reports",
    detail: "Download released verification reports",
    to: "/client-portal/reports",
    terms: "report pdf download final",
    permission: "report:read",
  },
  {
    label: "Custom export",
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
  caseSearchParams,
  placeholder = "Search features or cases…",
}: {
  destinations?: readonly WorkspaceDestination[];
  caseSearchTo?: string;
  caseSearchParams?: Record<string, string>;
  placeholder?: string;
} = {}) {
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const id = useId();
  const box = useRef<HTMLInputElement>(null);
  // Ctrl K (or Cmd K) jumps to search from anywhere, as in most SaaS tools.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        const input = box.current;
        if (!input || !input.offsetParent) return;
        event.preventDefault();
        input.focus();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
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
      search: {
        ...(caseSearchParams ?? {}),
        ...(item.search ?? (item.view ? { view: item.view } : {})),
      },
    })),
    ...(term.trim() && allowed("case:read")
      ? [
          {
            label: `Search cases for “${term.trim()}”`,
            detail: "Search candidate name or case number",
            to: caseSearchTo,
            search: { ...(caseSearchParams ?? {}), q: term.trim() },
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
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-dim"
        aria-hidden
      />
      <kbd
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 rounded border border-line bg-surface px-1.5 py-0.5 font-mono text-[10px] leading-none text-dim lg:block"
      >
        Ctrl K
      </kbd>
      <input
        ref={box}
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
        className="h-[38px] w-full rounded-[10px] border border-line bg-page pr-3 pl-9 lg:pr-16 text-[13.5px] text-ink outline-none placeholder:text-dim/80 focus:border-brand/60 focus:bg-surface focus:ring-3 focus:ring-brand/15"
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
        <div className="absolute left-0 right-0 top-full z-40 mt-2 min-w-[230px] overflow-hidden rounded-xl border border-line bg-surface shadow-xl">
          <p className="border-b border-line px-3 py-2 text-[10px] font-bold tracking-wider text-dim uppercase">
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
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left hover:bg-brand-soft ${active === index ? "bg-brand-soft" : ""}`}
              >
                <span className="min-w-0 flex-1">
                  <strong className="block text-xs font-semibold text-ink">{option.label}</strong>
                  <span className="mt-0.5 block text-[11px] text-dim">{option.detail}</span>
                </span>
                <ArrowUpRight className="size-3.5 shrink-0 text-brand" />
              </button>
            ))}
            {!options.length && (
              <p className="p-3 text-xs text-dim">No matching features available.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
