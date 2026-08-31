"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CaseBulkBarProps {
  count: number;
  onClear: () => void;
  onExport: () => void;
}

export function CaseBulkBar({ count, onClear, onExport }: CaseBulkBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border bg-accent/45 px-5 py-3">
      <p className="num text-xs font-medium text-foreground">{count} selected on this page</p>
      <Button variant="outline" size="sm" onClick={onExport}>
        Export selection
      </Button>
      <Button variant="ghost" size="sm" className="ml-auto" onClick={onClear}>
        <X className="size-3.5" aria-hidden />
        Clear
      </Button>
    </div>
  );
}
