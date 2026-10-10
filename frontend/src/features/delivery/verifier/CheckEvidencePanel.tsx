import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, FileText, ImagePlus, Loader2, Trash2, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState, LoadingState } from "@/components/workspace/kit";
import { istText } from "@/components/workspace/format";
import { checkEvidenceApi, type CheckEvidenceFile } from "@/lib/backend-api/check-evidence";
import { cn } from "@/lib/utils";

const ACCEPT = "application/pdf,image/png,image/jpeg";
const sizeText = (bytes: number) =>
  bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;

/**
 * Proof for this check's report annexure. The verifier adds screenshots of where it
 * verified (e.g. the Aadhaar / UAN portal), written or email replies, photos or lab
 * reports, each with a short caption; QA and the RM see the same files in the report.
 */
export function CheckEvidencePanel({ checkId }: { checkId: string }) {
  const queryClient = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [caption, setCaption] = useState("");
  const key = ["check-evidence", checkId];
  const list = useQuery({ queryKey: key, queryFn: () => checkEvidenceApi.list(checkId) });
  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      let added = 0;
      for (const file of files) {
        try {
          await checkEvidenceApi.upload(checkId, file, caption);
          added += 1;
        } catch (error) {
          toast.error(`${file.name} not added`, {
            description: error instanceof Error ? error.message : "Try again.",
          });
        }
      }
      return added;
    },
    onSuccess: async (added) => {
      if (added) toast.success(`${added} proof file${added === 1 ? "" : "s"} added`);
      setCaption("");
      await queryClient.invalidateQueries({ queryKey: key });
    },
  });
  const data = list.data;
  const room = data ? data.maxFiles - data.items.length : 0;
  const pick = (files: FileList | null) => {
    if (!files?.length || !data) return;
    const chosen = Array.from(files);
    const tooBig = chosen.filter((file) => file.size > data.maxBytes);
    if (tooBig.length)
      toast.error(`${tooBig.map((file) => file.name).join(", ")} is larger than 8 MB`);
    const ok = chosen.filter((file) => file.size <= data.maxBytes).slice(0, room);
    if (ok.length < chosen.length - tooBig.length)
      toast.info(`Only ${room} more file${room === 1 ? "" : "s"} can be added to this check`);
    if (ok.length) upload.mutate(ok);
  };
  return (
    <section
      aria-label="Proof"
      className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-[16px] font-bold text-slate-900">Proof for the report</h2>
          <p className="text-[12.5px] text-slate-500">
            Add screenshots of where you verified (e.g. the Aadhaar or UAN portal), written or email
            replies, photos or lab reports. They appear in this check&apos;s annexure.
          </p>
        </div>
        {data ? (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[12px] font-semibold text-slate-600">
            {data.items.length} / {data.maxFiles}
          </span>
        ) : null}
      </header>
      {data?.canEdit ? (
        <div className="grid gap-2">
          <input
            value={caption}
            maxLength={300}
            onChange={(event) => setCaption(event.target.value)}
            placeholder="Caption for the next files, e.g. Aadhaar verified on UIDAI portal"
            aria-label="Caption for new proof"
            className="h-10 rounded-xl border border-slate-200 px-3 text-[13px] outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
          />
          <button
            type="button"
            disabled={upload.isPending || room <= 0}
            onClick={() => input.current?.click()}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              pick(event.dataTransfer.files);
            }}
            className={cn(
              "grid place-items-center gap-1 rounded-xl border-2 border-dashed px-4 py-6 text-center transition disabled:cursor-not-allowed disabled:opacity-60",
              dragging
                ? "border-blue-400 bg-blue-50"
                : "border-slate-300 bg-slate-50 hover:border-blue-300 hover:bg-blue-50/50",
            )}
          >
            {upload.isPending ? (
              <Loader2 className="size-6 animate-spin text-blue-600" aria-hidden />
            ) : (
              <UploadCloud className="size-6 text-blue-600" aria-hidden />
            )}
            <strong className="text-[13.5px] text-slate-800">
              {upload.isPending ? "Uploading…" : "Drop files here or click to add proof"}
            </strong>
            <span className="text-[12px] text-slate-500">
              PDF, PNG or JPEG · up to 8 MB each · several at once
            </span>
          </button>
          <input
            ref={input}
            type="file"
            accept={ACCEPT}
            multiple
            hidden
            aria-label="Add proof files"
            onChange={(event) => {
              pick(event.target.files);
              event.target.value = "";
            }}
          />
        </div>
      ) : null}
      {list.isError ? (
        <p className="text-[13px] text-red-600">{list.error.message}</p>
      ) : !data ? (
        <LoadingState label="Loading proof" />
      ) : !data.items.length ? (
        <EmptyState
          icon={ImagePlus}
          tone="neutral"
          title="No proof yet"
          detail={
            data.canEdit
              ? "Add at least one screenshot or reply before you complete the check."
              : "The verifier has not attached proof to this check."
          }
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2" aria-label="Proof files">
          {data.items.map((file) => (
            <EvidenceCard
              key={file.id}
              checkId={checkId}
              file={file}
              canEdit={data.canEdit}
              onChanged={() => queryClient.invalidateQueries({ queryKey: key })}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function EvidenceCard({
  checkId,
  file,
  canEdit,
  onChanged,
}: {
  checkId: string;
  file: CheckEvidenceFile;
  canEdit: boolean;
  onChanged: () => Promise<unknown>;
}) {
  const image = file.contentType.startsWith("image/");
  const thumb = useQuery({
    queryKey: ["check-evidence", checkId, file.id, "thumb"],
    queryFn: () => checkEvidenceApi.blob(checkId, file.id),
    enabled: image,
    staleTime: Infinity,
  });
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!thumb.data) return;
    const next = URL.createObjectURL(thumb.data);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [thumb.data]);
  const [caption, setCaption] = useState(file.caption ?? "");
  const saveCaption = useMutation({
    mutationFn: () => checkEvidenceApi.caption(checkId, file.id, caption),
    onSuccess: async () => {
      toast.success("Caption saved");
      await onChanged();
    },
    onError: (error: Error) => toast.error("Caption not saved", { description: error.message }),
  });
  const remove = useMutation({
    mutationFn: () => checkEvidenceApi.remove(checkId, file.id),
    onSuccess: async () => {
      toast.success(`${file.name} removed`);
      await onChanged();
    },
    onError: (error: Error) => toast.error("Not removed", { description: error.message }),
  });
  return (
    <li className="grid overflow-hidden rounded-xl border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() =>
          void checkEvidenceApi
            .open(checkId, file.id)
            .catch((error: Error) => toast.error(error.message))
        }
        className="grid h-36 place-items-center bg-slate-50 text-slate-400 hover:bg-slate-100"
        aria-label={`Open ${file.name}`}
      >
        {image && url ? (
          <img src={url} alt="" className="h-full w-full object-contain" />
        ) : image ? (
          <Loader2 className="size-5 animate-spin" aria-hidden />
        ) : (
          <FileText className="size-10" aria-hidden />
        )}
      </button>
      <div className="grid gap-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <span className="min-w-0">
            <strong className="block truncate text-[12.5px] text-slate-900">{file.name}</strong>
            <small className="text-[11.5px] text-slate-500">
              {sizeText(file.sizeBytes)} · {istText(file.uploadedAt)}
              {file.uploadedBy ? ` · ${file.uploadedBy}` : ""}
            </small>
          </span>
          <button
            type="button"
            onClick={() =>
              void checkEvidenceApi
                .open(checkId, file.id)
                .catch((error: Error) => toast.error(error.message))
            }
            className="grid size-7 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"
            aria-label={`Open ${file.name} in a new tab`}
          >
            <ExternalLink className="size-3.5" aria-hidden />
          </button>
        </div>
        {canEdit ? (
          <div className="flex gap-1.5">
            <input
              value={caption}
              maxLength={300}
              onChange={(event) => setCaption(event.target.value)}
              placeholder="Caption"
              aria-label={`Caption for ${file.name}`}
              className="h-8 min-w-0 flex-1 rounded-lg border border-slate-200 px-2 text-[12.5px] outline-none focus:border-blue-300"
            />
            <Button
              size="sm"
              variant="outline"
              disabled={caption === (file.caption ?? "")}
              loading={saveCaption.isPending}
              onClick={() => saveCaption.mutate()}
            >
              Save
            </Button>
            <Button
              size="sm"
              variant="ghost"
              loading={remove.isPending}
              onClick={() => remove.mutate()}
              aria-label={`Remove ${file.name}`}
            >
              <Trash2 className="size-3.5 text-red-600" aria-hidden />
            </Button>
          </div>
        ) : file.caption ? (
          <p className="text-[12.5px] text-slate-700">{file.caption}</p>
        ) : null}
      </div>
    </li>
  );
}
