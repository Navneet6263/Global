"use client";

import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export function GlobalSearch() {
  const navigate = useNavigate();
  const [term, setTerm] = useState("");

  return (
    <form
      role="search"
      className="relative w-full max-w-md"
      onSubmit={(event) => {
        event.preventDefault();
        const search = term.trim();
        void navigate({ to: "/admin/cases", search: search ? { q: search } : {} });
      }}
    >
      <label htmlFor="global-search" className="sr-only">
        Search candidates, case numbers or clients
      </label>
      <Search
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        id="global-search"
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        placeholder="Search candidate, case number or client…"
        className="h-9 rounded-xl pl-9"
        autoComplete="off"
      />
    </form>
  );
}
