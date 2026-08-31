"use client";

import { useId, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { NavWorkspace } from "@/config/navigation";
import { WORKSPACE_PRESENTATION } from "@/config/workspace-presentation";

export function GlobalSearch({ workspace }: { workspace: NavWorkspace }) {
  const navigate = useNavigate();
  const inputId = useId();
  const [term, setTerm] = useState("");
  const searchConfig = WORKSPACE_PRESENTATION[workspace].search;

  if (!searchConfig) return null;

  return (
    <form
      role="search"
      className="relative w-full max-w-md"
      onSubmit={(event) => {
        event.preventDefault();
        const search = term.trim();
        void navigate({
          to: searchConfig.route as "/admin/cases",
          search: search ? { q: search } : {},
        });
      }}
    >
      <label htmlFor={inputId} className="sr-only">
        Search candidates, case numbers or clients
      </label>
      <Search
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        id={inputId}
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        placeholder={searchConfig.placeholder}
        className="h-9 rounded-xl pl-9"
        autoComplete="off"
      />
    </form>
  );
}
