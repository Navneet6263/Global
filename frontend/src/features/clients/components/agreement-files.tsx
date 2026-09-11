import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileCheck2, Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  listAgreementFiles,
  uploadAgreementFile,
  reviewAgreementFile,
  downloadAgreementFile,
  type AgreementFile,
} from "@/lib/backend-api/agreement-files";
import { formatDateTime } from "@/lib/formatting";

export function AgreementFiles({
  clientId,
  agreements,
}: {
  clientId: string;
  agreements: Array<{ id: string; type: string; reference: string }>;
}) {
  const [selected, setSelected] = useState("");
  const id = agreements.some((a) => a.id === selected) ? selected : "";
  return (
    <section className="space-y-4 rounded-2xl border border-mint/30 bg-mint-soft/20 p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <FileCheck2 className="size-4 text-mint-deep" />
        Contract files & review
      </h3>
      <p className="text-xs text-muted-foreground">
        Private, versioned originals. Latest signed agreement and DPA must be independently reviewed
        before new client activation. Signature review is a human check, not an e-signature service.
      </p>
      <label className="block space-y-1 text-xs">
        Saved agreement
        <select
          className="h-10 w-full rounded-xl border bg-white px-3"
          value={id}
          onChange={(e) => setSelected(e.target.value)}
        >
          <option value="">Choose an agreement reference</option>
          {agreements.map((a) => (
            <option key={a.id} value={a.id}>
              {a.type} · {a.reference}
            </option>
          ))}
        </select>
      </label>
      {!agreements.length && (
        <p className="text-xs">Save a reference above to attach a document.</p>
      )}
      {id && <FilesWorkspace key={`${clientId}-${id}`} clientId={clientId} agreementId={id} />}
    </section>
  );
}
function FilesWorkspace({ clientId, agreementId }: { clientId: string; agreementId: string }) {
  const client = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [page, setPage] = useState(0);
  const [inputKey, setInputKey] = useState(0);
  const query = useQuery({
    queryKey: ["agreement-files", clientId, agreementId],
    queryFn: () => listAgreementFiles(clientId, agreementId),
  });
  const refresh = () => {
    void client.invalidateQueries({ queryKey: ["agreement-files", clientId, agreementId] });
    void client.invalidateQueries({ queryKey: ["clients"] });
  };
  const upload = useMutation({
    mutationFn: () => uploadAgreementFile(clientId, agreementId, file!),
    onSuccess: () => {
      setFile(null);
      setInputKey(inputKey + 1);
      setPage(0);
      refresh();
      toast.success("Original uploaded — independent review pending");
    },
    onError: (error) => toast.error(error.message),
  });
  return (
    <div className="space-y-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (file) upload.mutate();
        }}
        className="space-y-2"
      >
        <Input
          key={inputKey}
          type="file"
          accept="application/pdf,image/jpeg,image/png"
          aria-label="Original agreement file"
          onChange={(e) => {
            const chosen = e.target.files?.[0];
            if (chosen && chosen.size > 10_485_760) {
              toast.error("Maximum file size is 10 MB");
              e.target.value = "";
              setFile(null);
            } else setFile(chosen ?? null);
          }}
        />
        <Button
          type="submit"
          size="sm"
          disabled={!file || upload.isPending}
          loading={upload.isPending}
        >
          <Upload className="size-3.5" />
          {upload.isPending ? "Uploading…" : "Upload new revision"}
        </Button>
        <p className="text-[11px] text-muted-foreground">
          Readable PDF, JPEG or PNG · 10 MB maximum · old revisions are preserved.
        </p>
      </form>
      {query.isPending && (
        <p role="status" className="text-xs">
          Loading files…
        </p>
      )}
      {query.isError && (
        <p role="alert" className="text-xs text-destructive">
          {query.error.message}
          <Button size="sm" variant="ghost" onClick={() => void query.refetch()}>
            Retry
          </Button>
        </p>
      )}
      {query.data?.items.slice(page * 5, page * 5 + 5).map((item, i) => (
        <FileCard
          key={item.id}
          clientId={clientId}
          agreementId={agreementId}
          file={item}
          latest={page === 0 && i === 0}
          onSaved={refresh}
        />
      ))}
      {query.data && !query.data.items.length && (
        <p className="text-xs text-muted-foreground">No original uploaded yet.</p>
      )}
      {query.data && query.data.items.length > 5 && (
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" disabled={!page} onClick={() => setPage(page - 1)}>
            Previous
          </Button>
          <span className="text-xs">
            {page + 1} / {Math.ceil(query.data.items.length / 5)}
          </span>
          <Button
            variant="ghost"
            size="sm"
            disabled={(page + 1) * 5 >= query.data.items.length}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
function FileCard({
  clientId,
  agreementId,
  file,
  latest,
  onSaved,
}: {
  clientId: string;
  agreementId: string;
  file: AgreementFile;
  latest: boolean;
  onSaved: () => void;
}) {
  const [notes, setNotes] = useState("");
  const [checked, setChecked] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const download = useMutation({
    mutationFn: () => downloadAgreementFile(clientId, agreementId, file),
    onError: (error) => toast.error(error.message),
  });
  const review = useMutation({
    mutationFn: (status: string) =>
      reviewAgreementFile(clientId, agreementId, file, {
        status,
        notes,
        signaturesChecked: checked,
      }),
    onSuccess: () => {
      setReviewing(false);
      onSaved();
      toast.success("Document review recorded");
    },
    onError: (error) => {
      toast.error(error.message);
      onSaved();
    },
  });
  return (
    <article className="space-y-2 rounded-xl border bg-white/80 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 break-words text-xs font-medium">
          r{file.revision} · {file.originalName}
        </p>
        <span
          className={`shrink-0 rounded-full px-2 py-1 text-[10px] ${file.status === "APPROVED" ? "bg-mint-soft text-mint-deep" : file.status === "REJECTED" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-800"}`}
        >
          {file.status}
        </span>
      </div>
      <p className="text-[11px] text-muted-foreground">
        {formatDateTime(file.createdAt)} · {(file.sizeBytes / 1024).toFixed(0)} KB
        {latest ? " · Latest" : " · Historical revision"}
      </p>
      {file.reviewNotes && <p className="text-xs">{file.reviewNotes}</p>}
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={download.isPending}
          loading={download.isPending}
          onClick={() => download.mutate()}
        >
          <Download className="size-3.5" />
          {download.isPending ? "Opening…" : "Original"}
        </Button>
        {latest && file.status === "PENDING" && !file.isUploader && (
          <Button size="sm" variant="outline" onClick={() => setReviewing(!reviewing)}>
            Review
          </Button>
        )}
      </div>
      {latest && file.status === "PENDING" && file.isUploader && (
        <p className="text-[11px] text-muted-foreground">
          Another authorised colleague must review this upload.
        </p>
      )}
      {reviewing && (
        <div className="space-y-2">
          <label className="flex items-start gap-2 text-xs">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
            />
            I opened the original and checked the signatories, scope and validity.
          </label>
          <Textarea
            aria-label="Contract review rationale"
            value={notes}
            maxLength={1000}
            onChange={(e) => setNotes(e.target.value)}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={review.isPending || !checked || notes.trim().length < 10}
              loading={review.isPending && review.variables === "APPROVED"}
              onClick={() => review.mutate("APPROVED")}
            >
              Approve original
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={review.isPending || notes.trim().length < 10}
              loading={review.isPending && review.variables === "REJECTED"}
              onClick={() => review.mutate("REJECTED")}
            >
              Request replacement
            </Button>
          </div>
        </div>
      )}
    </article>
  );
}
