"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface BranchDraft {
  code: string;
  name: string;
  city?: string;
}
export interface PackageDraft {
  code: string;
  name: string;
  checks: string[];
  price?: number;
  tatHours: number;
}

interface DialogProps<T> {
  open: boolean;
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (draft: T) => void;
}

export function AddBranchDialog(props: DialogProps<BranchDraft>) {
  const [draft, setDraft] = useState<BranchDraft>({ code: "", name: "", city: "" });
  const valid = /^[A-Za-z0-9_-]{2,32}$/.test(draft.code) && draft.name.trim().length >= 2;
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add operating branch</DialogTitle>
          <DialogDescription>
            Create a server-backed location for user and case scope.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Branch code">
            <Input
              value={draft.code}
              onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })}
              placeholder="DELHI_NCR"
            />
          </Field>
          <Field label="City">
            <Input
              value={draft.city}
              onChange={(e) => setDraft({ ...draft, city: e.target.value })}
              placeholder="New Delhi"
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Branch name">
              <Input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Delhi NCR Office"
              />
            </Field>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => props.onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!valid || props.submitting}
            onClick={() => props.onSubmit({ ...draft, city: draft.city?.trim() || undefined })}
          >
            {props.submitting ? "Adding…" : "Add branch"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const CHECKS = ["IDENTITY", "ADDRESS", "EMPLOYMENT", "EDUCATION", "CRIMINAL", "REFERENCE"];

export function AddPackageDialog(props: DialogProps<PackageDraft>) {
  const [draft, setDraft] = useState({
    code: "",
    name: "",
    checks: [] as string[],
    price: "",
    tatHours: "72",
  });
  const toggle = (check: string) =>
    setDraft((current) => ({
      ...current,
      checks: current.checks.includes(check)
        ? current.checks.filter((item) => item !== check)
        : [...current.checks, check],
    }));
  const valid =
    /^[A-Za-z0-9_-]{2,40}$/.test(draft.code) &&
    draft.name.trim().length >= 2 &&
    draft.checks.length > 0 &&
    Number(draft.tatHours) > 0;
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add service package</DialogTitle>
          <DialogDescription>
            Publish a reusable check bundle with commercial defaults.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Package code">
            <Input
              value={draft.code}
              onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })}
              placeholder="STANDARD_BGV"
            />
          </Field>
          <Field label="Package name">
            <Input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="Standard BGV"
            />
          </Field>
          <Field label="Price (₹)">
            <Input
              type="number"
              min="0"
              value={draft.price}
              onChange={(e) => setDraft({ ...draft, price: e.target.value })}
            />
          </Field>
          <Field label="Turnaround hours">
            <Input
              type="number"
              min="1"
              max="8760"
              value={draft.tatHours}
              onChange={(e) => setDraft({ ...draft, tatHours: e.target.value })}
            />
          </Field>
        </div>
        <fieldset className="space-y-2">
          <legend className="text-xs font-medium">Included checks</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {CHECKS.map((check) => (
              <label
                key={check}
                className="flex items-center gap-2 rounded-xl bg-muted/50 px-3 py-2 text-xs"
              >
                <Checkbox
                  checked={draft.checks.includes(check)}
                  onCheckedChange={() => toggle(check)}
                />
                {check.replaceAll("_", " ")}
              </label>
            ))}
          </div>
        </fieldset>
        <DialogFooter>
          <Button variant="ghost" onClick={() => props.onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!valid || props.submitting}
            onClick={() =>
              props.onSubmit({
                code: draft.code,
                name: draft.name,
                checks: draft.checks,
                price: draft.price ? Number(draft.price) : undefined,
                tatHours: Number(draft.tatHours),
              })
            }
          >
            {props.submitting ? "Adding…" : "Add package"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <Label className="mb-1.5 block text-xs">{label}</Label>
      {children}
    </div>
  );
}
