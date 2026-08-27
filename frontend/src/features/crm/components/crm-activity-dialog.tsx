"use client";

import { useState } from "react";
import type { SalesActivityType } from "../contracts/crm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const LOGGABLE: readonly { id: SalesActivityType; label: string }[] = [
  { id: "CALL", label: "Call" },
  { id: "EMAIL", label: "Email" },
  { id: "MEETING", label: "Meeting" },
  { id: "NOTE", label: "Note" },
  { id: "FOLLOW_UP", label: "Follow-up" },
];

export interface ActivitySubmitPayload {
  type: SalesActivityType;
  summary: string;
  occurredAt: string;
  nextFollowUpAt: string | null;
  notes: string;
}

interface CrmActivityDialogProps {
  company?: string;
  open: boolean;
  submitting?: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: ActivitySubmitPayload) => void;
}

export function CrmActivityDialog({
  company,
  open,
  submitting,
  onOpenChange,
  onSubmit,
}: CrmActivityDialogProps) {
  const [type, setType] = useState<SalesActivityType>("CALL");
  const [summary, setSummary] = useState("");
  const [occurredAt, setOccurredAt] = useState("2026-08-26");
  const [nextFollowUpAt, setNextFollowUpAt] = useState("");
  const [notes, setNotes] = useState("");
  const invalid = summary.trim().length < 4;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log activity{company ? ` — ${company}` : ""}</DialogTitle>
          <DialogDescription>
            Activity updates last-touch tracking and the follow-up queue.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={type} onValueChange={(value) => setType(value as SalesActivityType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOGGABLE.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="activity-summary">Summary</Label>
            <Input
              id="activity-summary"
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              placeholder="Discussed rate card and TAT expectations"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="activity-date">Happened on</Label>
              <Input
                id="activity-date"
                type="date"
                value={occurredAt}
                onChange={(event) => setOccurredAt(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="activity-next">Next follow-up</Label>
              <Input
                id="activity-next"
                type="date"
                value={nextFollowUpAt}
                onChange={(event) => setNextFollowUpAt(event.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="activity-notes">Notes</Label>
            <Textarea
              id="activity-notes"
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={invalid || submitting}
            onClick={() =>
              onSubmit({
                type,
                summary: summary.trim(),
                occurredAt: new Date(`${occurredAt}T10:00:00.000Z`).toISOString(),
                nextFollowUpAt: nextFollowUpAt
                  ? new Date(`${nextFollowUpAt}T05:30:00.000Z`).toISOString()
                  : null,
                notes,
              })
            }
          >
            Save activity
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
