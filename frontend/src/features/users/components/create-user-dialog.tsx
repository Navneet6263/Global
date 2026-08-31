"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ROLE_DEFINITIONS, type Role } from "@/config/roles";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CreateUserInput } from "@/lib/contracts/user";
import { UserRolePicker } from "./user-role-picker";

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
export interface ScopeOption {
  id: string;
  label: string;
}

interface CreateUserDialogProps {
  open: boolean;
  submitting: boolean;
  branches: readonly ScopeOption[];
  clients: readonly ScopeOption[];
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: CreateUserInput) => void;
}

export function CreateUserDialog(props: CreateUserDialogProps) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [branchId, setBranchId] = useState("all");
  const [clientId, setClientId] = useState("none");
  const [scopeError, setScopeError] = useState("");
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { fullName: "", email: "", mobile: "" },
  });

  const submit = (values: FormValues) => {
    if (!roles.length) return;
    if (roles.includes("CLIENT_ADMIN") && clientId === "none") {
      setScopeError("Select the client workspace for this Client Admin.");
      return;
    }
    const branch = props.branches.find((item) => item.id === branchId);
    const client = roles.includes("CLIENT_ADMIN")
      ? props.clients.find((item) => item.id === clientId)
      : undefined;
    props.onSubmit({
      fullName: values.fullName,
      email: values.email,
      mobile: values.mobile || undefined,
      roles,
      branchId: branch?.id,
      branchLabel: branch?.label,
      clientId: client?.id,
      clientLabel: client?.label,
      additionalAccessConfirmed: roles.length > 1,
    });
  };

  useEffect(() => {
    if (props.open) return;
    form.reset({ fullName: "", email: "", mobile: "" });
    setRoles([]);
    setBranchId("all");
    setClientId("none");
    setScopeError("");
  }, [form, props.open]);

  const needsBranch = roles.some((role) => ROLE_DEFINITIONS[role].scopeFields.includes("branch"));

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Create user ID</DialogTitle>
          <DialogDescription>
            Assign only the role and server-validated scope this person needs.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-5" onSubmit={form.handleSubmit(submit)}>
          <UserRolePicker
            selected={roles}
            onChange={(value) => {
              setRoles(value);
              if (!value.includes("CLIENT_ADMIN")) setScopeError("");
            }}
          />
          <div className="grid gap-4 border-t border-border pt-5 sm:grid-cols-2">
            <Field label="Full name" error={form.formState.errors.fullName?.message}>
              <Input placeholder="Rohan Iyer" {...form.register("fullName")} />
            </Field>
            <Field label="Work email" error={form.formState.errors.email?.message}>
              <Input
                type="email"
                placeholder="rohan@saplingglobal.in"
                {...form.register("email")}
              />
            </Field>
            <Field label="Mobile (optional)" error={form.formState.errors.mobile?.message}>
              <Input inputMode="numeric" placeholder="9876543210" {...form.register("mobile")} />
            </Field>
            {needsBranch ? (
              <Field
                label="Operating branch"
                hint="Limits this account to work assigned to that office. It does not route cases from an address automatically."
              >
                <Select value={branchId} onValueChange={setBranchId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tenant-wide / all branches</SelectItem>
                    {props.branches.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            ) : null}
            {roles.includes("CLIENT_ADMIN") ? (
              <div className="sm:col-span-2">
                <Field label="Client workspace" error={scopeError}>
                  <Select
                    value={clientId}
                    onValueChange={(value) => {
                      setClientId(value);
                      setScopeError("");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Select a client workspace</SelectItem>
                      {props.clients.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            ) : null}
          </div>
          <p className="rounded-2xl bg-mint-soft/70 px-4 py-3 text-xs text-mint-deep">
            A one-time temporary password is generated only after the API creates the account.
          </p>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => props.onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={props.submitting || roles.length === 0}>
              {props.submitting ? "Creating…" : "Create user ID"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <Label className="mb-1.5 block text-xs">{label}</Label>
      {children}
      {hint ? <p className="mt-1 text-[10px] leading-4 text-muted-foreground">{hint}</p> : null}
      {error ? <p className="mt-1 text-[11px] text-critical-foreground">{error}</p> : null}
    </div>
  );
}
