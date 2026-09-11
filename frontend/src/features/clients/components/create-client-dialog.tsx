"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import type { ClientDraft } from "@/lib/contracts/client";

const schema = z.object({
  name: z.string().min(3, "Enter the registered company name"),
  slaCommitmentDays: z.coerce.number().int().min(1).max(30),
  primaryContactName: z.string().min(3, "Contact name is required"),
  primaryContactEmail: z.string().email("Enter a valid work email"),
});

type FormValues = z.input<typeof schema>;

interface CreateClientDialogProps {
  open: boolean;
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (draft: ClientDraft) => void;
}

export function CreateClientDialog({
  open,
  submitting,
  onOpenChange,
  onSubmit,
}: CreateClientDialogProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      slaCommitmentDays: 5,
      primaryContactName: "",
      primaryContactEmail: "",
    },
  });
  useEffect(() => {
    if (!open) form.reset();
  }, [form, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Onboard a client</DialogTitle>
          <DialogDescription>
            Creates a client workspace with its SLA commitment and primary contact.
          </DialogDescription>
        </DialogHeader>

        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={form.handleSubmit((values) => {
            onSubmit(schema.parse(values));
          })}
        >
          <Field
            id="name"
            label="Company name"
            className="sm:col-span-2"
            error={form.formState.errors.name?.message}
          >
            <Input id="name" placeholder="Meridian Financial Services" {...form.register("name")} />
          </Field>
          <Field
            id="slaCommitmentDays"
            label="SLA commitment (days)"
            error={form.formState.errors.slaCommitmentDays?.message}
          >
            <Input
              id="slaCommitmentDays"
              type="number"
              min={1}
              max={30}
              {...form.register("slaCommitmentDays")}
            />
          </Field>
          <Field
            id="primaryContactName"
            label="Primary contact"
            error={form.formState.errors.primaryContactName?.message}
          >
            <Input
              id="primaryContactName"
              placeholder="Ananya Rao"
              {...form.register("primaryContactName")}
            />
          </Field>
          <Field
            id="primaryContactEmail"
            label="Contact email"
            className="sm:col-span-2"
            error={form.formState.errors.primaryContactEmail?.message}
          >
            <Input
              id="primaryContactEmail"
              type="email"
              placeholder="ananya.rao@company.in"
              {...form.register("primaryContactEmail")}
            />
          </Field>

          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} loading={submitting}>
              {submitting ? "Creating…" : "Create client"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  id,
  label,
  error,
  className,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <Label htmlFor={id} className="mb-1.5 block text-xs">
        {label}
      </Label>
      {children}
      {error ? <p className="mt-1 text-[11px] text-critical-foreground">{error}</p> : null}
    </div>
  );
}
