import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  CheckCircle2,
  Clock3,
  FileCheck2,
  Loader2,
  LockKeyhole,
  MessageSquareText,
  ShieldCheck,
  UploadCloud,
} from "lucide-react";
import { useEffect, useState } from "react";

import { getCandidatePortal, uploadCandidateDocument } from "@/lib/api/candidate-portal";
import { documentTypes, type DocumentType } from "@/lib/api/documents";

export const Route = createFileRoute("/candidate/$accessId")({
  component: CandidatePortalPage,
  head: () => ({ meta: [{ title: "Candidate workspace — Sapling Global" }] }),
});

function CandidatePortalPage() {
  const { accessId } = Route.useParams();
  const queryClient = useQueryClient();
  const [token, setToken] = useState("");
  const [type, setType] = useState<DocumentType>("ADDRESS_PROOF");
  const [file, setFile] = useState<File | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    setToken(params.get("token") ?? "");
  }, []);
  const portal = useQuery({
    queryKey: ["candidate-portal", accessId, token],
    queryFn: () => getCandidatePortal(accessId, token),
    enabled: Boolean(token),
    retry: false,
  });
  const upload = useMutation({
    mutationFn: () => {
      if (!file) throw new Error("Select a file first");
      return uploadCandidateDocument(accessId, token, type, file);
    },
    onSuccess: async () => {
      setFile(null);
      await queryClient.invalidateQueries({ queryKey: ["candidate-portal", accessId, token] });
    },
  });
  const data = portal.data?.case;
  const completed = data?.checks.filter((check) => check.status === "COMPLETED").length ?? 0;
  const progress = data?.checks.length ? Math.round((completed / data.checks.length) * 100) : 0;
  return (
    <main className="canvas-mesh min-h-screen bg-background px-4 py-8 text-foreground sm:py-14">
      <div className="mx-auto max-w-4xl">
        <Brand />
        {!token ? (
          <Unavailable message="The secure access token is missing from this link." />
        ) : null}
        {portal.isLoading ? <div className="surface h-96 animate-pulse rounded-[2rem]" /> : null}
        {portal.isError ? <Unavailable message={portal.error.message} /> : null}
        {portal.data && data ? (
          <div className="space-y-5">
            <section className="surface-float overflow-hidden rounded-[2rem]">
              <header className="ink-panel p-6 sm:p-8">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent">
                  {data.caseNumber}
                </p>
                <h1 className="mt-3 text-3xl font-bold">Hello, {data.candidateName}</h1>
                <p className="mt-2 text-sm opacity-65">
                  Verification requested by {data.clientName} · access expires{" "}
                  {formatDate(portal.data.expiresAt)}
                </p>
              </header>
              <div className="p-6 sm:p-8">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Overall progress
                    </p>
                    <p className="mt-1 text-3xl font-bold">{progress}%</p>
                  </div>
                  <Status value={data.status} />
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-accent transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <Fact icon={ShieldCheck} label="Consent" value={humanize(data.consentStatus)} />
                  <Fact
                    icon={FileCheck2}
                    label="Checks"
                    value={`${completed} of ${data.checks.length} complete`}
                  />
                  <Fact
                    icon={Clock3}
                    label="Expected by"
                    value={data.dueAt ? formatDate(data.dueAt) : "To be confirmed"}
                  />
                </div>
              </div>
            </section>
            <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
              <section className="surface rounded-3xl p-5">
                <h2 className="text-sm font-semibold">Verification checks</h2>
                <p className="text-xs text-muted-foreground">
                  Only progress is shown; internal verification sources remain protected.
                </p>
                <div className="mt-4 space-y-2">
                  {data.checks.map((check) => (
                    <div
                      key={check.type}
                      className="flex items-center justify-between rounded-2xl bg-secondary/45 p-3"
                    >
                      <p className="text-sm font-medium">{humanize(check.type)}</p>
                      <Status value={check.status} />
                    </div>
                  ))}
                </div>
                {data.clarifications.length ? (
                  <div className="mt-5">
                    <h3 className="text-xs font-semibold">Information requests</h3>
                    <div className="mt-2 space-y-2">
                      {data.clarifications.map((item, index) => (
                        <div
                          key={`${item.subject}-${index}`}
                          className="flex items-start gap-3 rounded-2xl border border-warning/25 bg-warning/10 p-3"
                        >
                          <MessageSquareText className="mt-0.5 h-4 w-4 text-warning-foreground" />
                          <div>
                            <p className="text-xs font-semibold">{item.subject}</p>
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              {humanize(item.status)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </section>
              <section className="surface rounded-3xl p-5">
                <h2 className="text-sm font-semibold">Upload supporting document</h2>
                <p className="text-xs leading-5 text-muted-foreground">
                  Files are validated, integrity-hashed and attached only to this case.
                </p>
                <div className="mt-4 space-y-3">
                  <select
                    value={type}
                    onChange={(event) => setType(event.target.value as DocumentType)}
                    className="h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm"
                  >
                    {documentTypes.map((value) => (
                      <option key={value} value={value}>
                        {humanize(value)}
                      </option>
                    ))}
                  </select>
                  <label className="flex h-24 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-secondary/30 text-center">
                    <UploadCloud className="h-5 w-5 text-muted-foreground" />
                    <span className="mt-2 max-w-full truncate px-4 text-xs text-muted-foreground">
                      {file?.name ?? "Choose a PDF or image up to the allowed limit"}
                    </span>
                    <input
                      key={file?.name ?? "empty"}
                      type="file"
                      accept="application/pdf,image/jpeg,image/png"
                      onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                      className="sr-only"
                    />
                  </label>
                  {upload.isError ? (
                    <p className="text-xs text-destructive">{upload.error.message}</p>
                  ) : null}
                  {upload.isSuccess ? (
                    <p className="flex items-center gap-2 text-xs font-semibold text-accent-foreground">
                      <CheckCircle2 className="h-4 w-4" />
                      Document uploaded securely.
                    </p>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => upload.mutate()}
                    disabled={!file || upload.isPending}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    {upload.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <UploadCloud className="h-4 w-4" />
                    )}
                    Upload document
                  </button>
                </div>
                <div className="mt-5 border-t border-[var(--hairline)] pt-4">
                  <p className="text-xs font-semibold">Uploaded documents</p>
                  <div className="mt-2 space-y-2">
                    {data.documents.length ? (
                      data.documents.map((document, index) => (
                        <div
                          key={`${document.type}-${index}`}
                          className="flex items-center justify-between rounded-xl bg-secondary/45 px-3 py-2"
                        >
                          <span className="text-xs">{humanize(document.type)}</span>
                          <span className="text-[10px] text-muted-foreground">
                            v{document.currentVersion} · {humanize(document.status)}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-muted-foreground">No documents uploaded yet.</p>
                    )}
                  </div>
                </div>
              </section>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}

function Brand() {
  return (
    <div className="mb-6 flex items-center justify-center gap-2.5">
      <span className="ink-panel grid h-11 w-11 place-items-center rounded-2xl">
        <ShieldCheck className="h-5 w-5" />
      </span>
      <div>
        <p className="font-bold">Sapling Global</p>
        <p className="text-xs text-muted-foreground">Secure candidate workspace</p>
      </div>
    </div>
  );
}
function Unavailable({ message }: { message: string }) {
  return (
    <div className="surface rounded-[2rem] p-8 text-center">
      <LockKeyhole className="mx-auto h-7 w-7 text-destructive" />
      <h1 className="mt-4 text-xl font-bold">Candidate link is unavailable</h1>
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
function Fact({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof ShieldCheck;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-secondary/45 p-4">
      <Icon className="h-4 w-4 text-accent-foreground" />
      <p className="mt-2 text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-xs font-semibold">{value}</p>
    </div>
  );
}
function Status({ value }: { value: string }) {
  const complete = ["COMPLETED", "CLOSED", "ACCEPTED", "AVAILABLE"].includes(value);
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${complete ? "bg-accent/20 text-accent-foreground" : "bg-warning/20 text-warning-foreground"}`}
    >
      {humanize(value)}
    </span>
  );
}
function humanize(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(value));
}
