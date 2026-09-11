"use client";

import { useState } from "react";
import type { Opportunity } from "../contracts/crm";
import { LOST_REASONS } from "../config/crm";
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

interface WonDialogProps {
  submitting?: boolean;
  opportunity?: Opportunity;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (payload: { finalValue: number; notes: string }) => void;
}

export function CrmMarkWonDialog({
  opportunity,
  open,
  onOpenChange,
  onConfirm,
  submitting,
}: WonDialogProps) {
  const [finalValue, setFinalValue] = useState(String(opportunity?.estimatedValue ?? 0));
  const [notes, setNotes] = useState("");

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!submitting) onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark {opportunity?.company} as won</DialogTitle>
          <DialogDescription>
            Closed won revenue, win rate and forecast update immediately.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="final-value">Final contracted value (₹)</Label>
            <Input
              id="final-value"
              type="number"
              value={finalValue}
              onChange={(event) => setFinalValue(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="won-notes">Notes</Label>
            <Textarea
              id="won-notes"
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Rate card, start date, onboarding owner…"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={submitting} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            loading={submitting}
            onClick={() =>
              onConfirm({
                finalValue: Number(finalValue) || (opportunity?.estimatedValue ?? 0),
                notes,
              })
            }
          >
            {submitting ? "Confirming win…" : "Confirm win"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface LostDialogProps {
  submitting?: boolean;
  opportunity?: Opportunity;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (payload: { lostReason: string; competitor: string; notes: string }) => void;
}

export function CrmMarkLostDialog({
  opportunity,
  open,
  onOpenChange,
  onConfirm,
  submitting,
}: LostDialogProps) {
  const [lostReason, setLostReason] = useState(LOST_REASONS[0]!);
  const [competitor, setCompetitor] = useState("");
  const [notes, setNotes] = useState("");

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!submitting) onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark {opportunity?.company} as lost</DialogTitle>
          <DialogDescription>
            Loss reasons feed executive analytics and win-rate reporting.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Reason</Label>
            <Select value={lostReason} onValueChange={setLostReason}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOST_REASONS.map((reason) => (
                  <SelectItem key={reason} value={reason}>
                    {reason}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="competitor">Competitor (optional)</Label>
            <Input
              id="competitor"
              value={competitor}
              onChange={(event) => setCompetitor(event.target.value)}
              placeholder="AuthBridge, IDfy…"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lost-notes">Notes</Label>
            <Textarea
              id="lost-notes"
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={submitting} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            loading={submitting}
            onClick={() => onConfirm({ lostReason, competitor, notes })}
          >
            {submitting ? "Confirming loss…" : "Confirm loss"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
