"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

const BULK_ACTIONS = ["Reassign owner", "Raise priority", "Nudge candidate", "Export selection"];

interface CaseBulkBarProps {
  count: number;
  onClear: () => void;
  onAction: (label: string) => void;
}

export function CaseBulkBar({ count, onClear, onAction }: CaseBulkBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border bg-accent/45 px-5 py-3">
      <p className="num text-xs font-medium text-foreground">{count} selected</p>
      <div className="flex flex-wrap items-center gap-2">
        {BULK_ACTIONS.map((label) => (
          <Button key={label} variant="outline" size="sm" onClick={() => onAction(label)}>
            {label}
          </Button>
        ))}
      </div>
      <Button variant="ghost" size="sm" className="ml-auto" onClick={onClear}>
        <X className="size-3.5" aria-hidden />
        Clear
      </Button>
    </div>
  );
}
