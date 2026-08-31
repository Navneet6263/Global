"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Copy, Link2, Loader2, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { VerificationCase } from "@/lib/contracts/case";
import { getSession } from "@/lib/api/auth";
import { issueCandidateAccess } from "@/lib/api/candidate-portal";
import { formatDateTime } from "@/lib/formatting";

const OPEN_STAGES = new Set(["intake", "consent", "documents", "verification", "clarification"]);

export function CaseCandidateInvite({ item }: { item: VerificationCase }) {
  const [shareUrl, setShareUrl] = useState("");
  const session = useQuery({
    queryKey: ["session"],
    queryFn: getSession,
    staleTime: 60_000,
  });
  const canIssue =
    session.data?.permissions.includes("*") || session.data?.permissions.includes("case:create");
  const mutation = useMutation({
    mutationFn: () => issueCandidateAccess(item.id),
    onSuccess: (result) => {
      setShareUrl(
        window.location.origin +
          "/candidate/" +
          result.id +
          "#token=" +
          encodeURIComponent(result.token),
      );
      toast.success("Candidate upload link created", {
        description: result.delivery.queued
          ? result.delivery.channel +
            " queued to " +
            result.delivery.destination +
            " · expires " +
            formatDateTime(result.expiresAt)
          : "Copy and share the link securely.",
      });
    },
    onError: (error: Error) =>
      toast.error("Candidate link could not be created", {
        description: error.message,
      }),
  });

  if (!canIssue || !OPEN_STAGES.has(item.stage)) return null;

  const copy = () =>
    void navigator.clipboard
      .writeText(shareUrl)
      .then(() => toast.success("Candidate link copied"))
      .catch(() => toast.error("Copy failed; select the link manually"));

  return (
    <section className="rounded-xl border border-primary/15 bg-accent/25 p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-card text-primary">
          <Link2 className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Candidate document access</p>
          <p className="mt-0.5 text-[11px] leading-5 text-muted-foreground">
            Create a secure 14-day link and queue it to the candidate’s registered email or mobile.
          </p>
        </div>
        <button
          type="button"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-primary px-3 text-[11px] font-semibold text-primary-foreground disabled:opacity-50"
        >
          {mutation.isPending ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
          ) : (
            <Send className="size-3.5" aria-hidden />
          )}
          {shareUrl ? "Send again" : "Send link"}
        </button>
      </div>
      {shareUrl ? (
        <div className="mt-3 flex gap-2">
          <input
            readOnly
            value={shareUrl}
            aria-label="Candidate upload link"
            className="h-9 min-w-0 flex-1 rounded-xl border border-border bg-card px-3 text-xs"
          />
          <button
            type="button"
            onClick={copy}
            aria-label="Copy candidate upload link"
            className="grid size-9 shrink-0 place-items-center rounded-full bg-card text-primary shadow-sm"
          >
            <Copy className="size-3.5" aria-hidden />
          </button>
        </div>
      ) : null}
    </section>
  );
}
