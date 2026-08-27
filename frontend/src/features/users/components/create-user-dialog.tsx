"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ROLES, ROLE_DEFINITIONS, type Role } from "@/config/roles";
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
import type { CreateUserInput } from "@/lib/contracts/user";

const BRANCHES = ["Mumbai", "Bengaluru", "Delhi NCR", "Hyderabad", "Pune", "Chennai"];

const schema = z.object({
  fullName: z.string().min(3, "Enter the full legal name"),
  email: z.string().email("Enter a valid work email"),
  mobile: z
    .string()
    .regex(/^[6-9]\d{9}$/, "Enter a 10-digit Indian mobile number")
    .optional()
    .or(z.literal("")),
});

type FormValues = z.infer<typeof schema>;

interface CreateUserDialogProps {
  open: boolean;
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: CreateUserInput) => void;
}

export function CreateUserDialog({
  open,
  submitting,
  onOpenChange,
  onSubmit,
}: CreateUserDialogProps) {
  const [roles, setRoles] = useState<Role[]>(["VERIFIER"]);
  const [branches, setBranches] = useState<string[]>(["Mumbai"]);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { fullName: "", email: "", mobile: "" },
  });

  const toggle = <T,>(list: T[], value: T) =>
    list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create user ID</DialogTitle>
          <DialogDescription>
            Issues a platform ID with a temporary password and the selected role scope.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={form.handleSubmit((values) => {
            if (roles.length === 0) return;
            onSubmit({
              fullName: values.fullName,
              email: values.email,
              mobile: values.mobile || undefined,
              roles,
              branchScope: branches,
              clientWorkspaceScope: [],
            });
            form.reset();
          })}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="fullName" className="mb-1.5 block text-xs">
                Full name
              </Label>
              <Input id="fullName" placeholder="Rohan Iyer" {...form.register("fullName")} />
              {form.formState.errors.fullName ? (
                <p className="mt-1 text-[11px] text-critical-foreground">
                  {form.formState.errors.fullName.message}
                </p>
              ) : null}
            </div>
            <div>
              <Label htmlFor="email" className="mb-1.5 block text-xs">
                Work email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="rohan@saplingglobal.in"
                {...form.register("email")}
              />
              {form.formState.errors.email ? (
                <p className="mt-1 text-[11px] text-critical-foreground">
                  {form.formState.errors.email.message}
                </p>
              ) : null}
            </div>
            <div>
              <Label htmlFor="mobile" className="mb-1.5 block text-xs">
                Mobile (optional)
              </Label>
              <Input
                id="mobile"
                inputMode="numeric"
                placeholder="9876543210"
                {...form.register("mobile")}
              />
              {form.formState.errors.mobile ? (
                <p className="mt-1 text-[11px] text-critical-foreground">
                  {form.formState.errors.mobile.message}
                </p>
              ) : null}
            </div>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-xs font-medium text-foreground">Roles</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {ROLES.map((role) => (
                <label
                  key={role}
                  className="flex items-start gap-2 rounded-xl border border-border bg-card px-3 py-2 text-[12px]"
                >
                  <Checkbox
                    checked={roles.includes(role)}
                    onCheckedChange={() => setRoles((current) => toggle(current, role))}
                  />
                  <span className="min-w-0">
                    <span className="block font-medium text-foreground">
                      {ROLE_DEFINITIONS[role].label}
                    </span>
                    <span className="block text-[11px] text-muted-foreground">
                      {ROLE_DEFINITIONS[role].permissions.length} permissions
                    </span>
                  </span>
                </label>
              ))}
            </div>
            {roles.length === 0 ? (
              <p className="text-[11px] text-critical-foreground">Select at least one role.</p>
            ) : null}
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-xs font-medium text-foreground">Branch scope</legend>
            <div className="flex flex-wrap gap-2">
              {BRANCHES.map((branch) => (
                <label
                  key={branch}
                  className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-[12px]"
                >
                  <Checkbox
                    checked={branches.includes(branch)}
                    onCheckedChange={() => setBranches((current) => toggle(current, branch))}
                  />
                  {branch}
                </label>
              ))}
            </div>
          </fieldset>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || roles.length === 0}>
              {submitting ? "Creating…" : "Create user ID"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
