"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Eye, EyeOff, KeyRound, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
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

export interface TemporaryPasswordReceipt {
  kind: "created" | "reset";
  fullName: string;
  email: string;
  password: string;
}

interface TemporaryPasswordDialogProps {
  receipt: TemporaryPasswordReceipt | null;
  onClose: () => void;
}

export function TemporaryPasswordDialog({ receipt, onClose }: TemporaryPasswordDialogProps) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setRevealed(false);
    setCopied(false);
  }, [receipt]);

  const copyPassword = async () => {
    if (!receipt) return;
    try {
      await navigator.clipboard.writeText(receipt.password);
      setCopied(true);
      toast.success("Temporary password copied");
    } catch {
      toast.error("Copy failed", {
        description: "Reveal the password and copy it manually.",
      });
    }
  };

  return (
    <Dialog open={Boolean(receipt)} onOpenChange={() => undefined}>
      <DialogContent
        className="overflow-hidden border-primary/15 bg-[#fffdfa] p-0 shadow-[0_28px_90px_rgba(37,31,25,0.22)] sm:max-w-lg [&>button.absolute]:hidden"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <div className="border-b border-border/70 bg-gradient-to-br from-orange-50 via-white to-emerald-50 px-6 py-6">
          <span className="mb-4 grid size-12 place-items-center rounded-2xl bg-primary/12 text-primary">
            <KeyRound className="size-5" aria-hidden />
          </span>
          <DialogHeader>
            <DialogTitle>
              {receipt?.kind === "created" ? "User ID created" : "New password issued"}
            </DialogTitle>
            <DialogDescription>
              Save this one-time password now. It is shown only in this secure confirmation.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-5 px-6 py-5">
          <div className="rounded-2xl border border-border/70 bg-white px-4 py-3 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
                <ShieldCheck className="size-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  {receipt?.fullName}
                </p>
                <p className="truncate text-xs text-muted-foreground">{receipt?.email}</p>
              </div>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Temporary password
            </p>
            <div className="flex gap-2">
              <div className="relative min-w-0 flex-1">
                <Input
                  value={receipt?.password ?? ""}
                  readOnly
                  type={revealed ? "text" : "password"}
                  autoComplete="off"
                  spellCheck={false}
                  aria-label="Temporary password"
                  className="h-12 pr-11 font-mono text-sm tracking-wide"
                  onFocus={(event) => revealed && event.currentTarget.select()}
                />
                <button
                  type="button"
                  onClick={() => setRevealed((value) => !value)}
                  className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-xl text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={revealed ? "Hide temporary password" : "Reveal temporary password"}
                >
                  {revealed ? (
                    <EyeOff className="size-4" aria-hidden />
                  ) : (
                    <Eye className="size-4" aria-hidden />
                  )}
                </button>
              </div>
              <Button type="button" variant="outline" className="h-12 px-4" onClick={copyPassword}>
                {copied ? (
                  <Check className="size-4" aria-hidden />
                ) : (
                  <Copy className="size-4" aria-hidden />
                )}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>

          <p className="rounded-2xl bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900">
            Share it through an approved private channel. The user must change it at first sign-in.
          </p>
        </div>

        <DialogFooter className="border-t border-border/70 bg-white/80 px-6 py-4">
          <Button type="button" onClick={onClose} className="sm:min-w-40">
            I have saved it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
