import { useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ChevronRight, FileText, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { checkEvidenceApi } from "@/lib/backend-api/check-evidence";
import {
  reportPreviewApi,
  type AnnexureBlock,
  type ReportAudience,
  type ReportColour,
  type ReportView as ReportViewData,
  type ReportViewItem,
} from "@/lib/backend-api/report-preview";
import { cn } from "@/lib/utils";
import { dispositionMeta } from "./colour-codes";

/** Status colours, matching the PDF (Yellow carries dark text). */
const FILL: Record<ReportColour, string> = {
  GREEN: "bg-emerald-600 text-white",
  YELLOW: "bg-amber-300 text-slate-900",
  AMBER: "bg-orange-500 text-white",
  RED: "bg-red-600 text-white",
  BLUE: "bg-blue-600 text-white",
  CLIENT_REVIEW: "bg-white text-slate-700 ring-1 ring-inset ring-slate-300",
};
const DOT: Record<ReportColour, string> = {
  GREEN: "bg-emerald-500",
  YELLOW: "bg-amber-400",
  AMBER: "bg-orange-500",
  RED: "bg-red-600",
  BLUE: "bg-blue-600",
  CLIENT_REVIEW: "bg-white ring-1 ring-slate-400",
};

const ROMAN: Array<[number, string]> = [
  [1000, "M"],
  [900, "CM"],
  [500, "D"],
  [400, "CD"],
  [100, "C"],
  [90, "XC"],
  [50, "L"],
  [40, "XL"],
  [10, "X"],
  [9, "IX"],
  [5, "V"],
  [4, "IV"],
  [1, "I"],
];
const roman = (value: number) => {
  let rest = value;
  let out = "";
  for (const [size, letters] of ROMAN)
    while (rest >= size) {
      out += letters;
      rest -= size;
    }
  return out;
};

/** Severity legend names; "Insufficient / Interim" carries no colour. */
const colourName = (colour: ReportColour) => dispositionMeta[colour].name;

const day = (value?: string | null) =>
  value
    ? new Date(`${value.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      })
    : "";

export function ColourPill({
  colour,
  children,
  className,
}: {
  colour: ReportColour | null;
  children?: ReactNode;
  className?: string;
}) {
  if (!colour)
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11.5px] font-semibold text-slate-500",
          className,
        )}
      >
        {children ?? "Pending"}
      </span>
    );
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-[11.5px] font-semibold",
        FILL[colour],
        className,
      )}
    >
      {children ?? colourName(colour)}
    </span>
  );
}

/** Loads and shows a case's report on screen (QA review, RM final review). */
export function CaseReportView({
  caseId,
  audience,
  itemAction,
}: {
  caseId: string;
  audience: ReportAudience;
  /** Extra control on each annexure, e.g. QA's "Return for rework". */
  itemAction?: (item: ReportViewItem) => ReactNode;
}) {
  const report = useQuery({
    queryKey: ["report-view", caseId, audience],
    queryFn: () => reportPreviewApi.view(caseId, audience),
  });
  if (report.isPending)
    return (
      <div className="grid gap-3" aria-busy="true">
        <p className="flex items-center gap-2 text-[13px] text-slate-500">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Building the report…
        </p>
        {[0, 1, 2].map((row) => (
          <div key={row} className="h-24 animate-pulse rounded-xl bg-slate-100" />
        ))}
      </div>
    );
  if (report.isError)
    return (
      <div className="grid justify-items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4">
        <p role="alert" className="text-[13px] text-red-700">
          {report.error.message}
        </p>
        <Button size="sm" variant="outline" onClick={() => void report.refetch()}>
          <RefreshCw aria-hidden /> Try again
        </Button>
      </div>
    );
  return <ReportView data={report.data} itemAction={itemAction} />;
}

export function ReportView({
  data,
  itemAction,
}: {
  data: ReportViewData;
  itemAction?: (item: ReportViewItem) => ReactNode;
}) {
  const internal = new Map(data.internal.map((check) => [check.checkId, check]));
  const counts = new Map<ReportColour, number>();
  for (const item of data.items)
    if (item.disposition) counts.set(item.disposition, (counts.get(item.disposition) ?? 0) + 1);
  // Figures are numbered across the whole report, as in the PDF.
  const figureStart = new Map<number, number>();
  let figures = 0;
  for (const item of data.items) {
    figureStart.set(item.annexure, figures);
    figures += item.proofs.length;
  }
  const jump = (annexure: number) =>
    document
      .getElementById(`annexure-${annexure}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  return (
    <div className="grid min-w-0 gap-5">
      <section
        aria-label="Executive summary"
        className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
      >
        <header className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 px-5 py-4 text-white">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-300">
              Executive summary
            </p>
            <h3 className="truncate text-[17px] font-semibold">{data.candidateName}</h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-slate-300">Report disposition</span>
            <ColourPill colour={data.overall} className="px-3 py-1 text-[13px]">
              {data.overall ? undefined : "In progress"}
            </ColourPill>
          </div>
        </header>
        <dl className="grid grid-cols-2 gap-px bg-slate-100 sm:grid-cols-3">
          {(
            [
              ["Sapling ID", data.caseNumber],
              ["Employee code", data.header.employeeCode || "Not provided"],
              [
                "Client / process",
                [data.clientName, data.header.clientProcess].filter(Boolean).join(" / "),
              ],
              ["Date of joining", day(data.header.joiningDate) || "Not provided"],
              [
                "Checks",
                `${data.items.length}${data.pendingChecks ? ` · ${data.pendingChecks} pending` : ""}`,
              ],
              ["Copy", data.audience === "internal" ? "Internal" : "Client"],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="min-w-0 bg-white px-4 py-3">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                {label}
              </dt>
              <dd className="truncate text-[13px] font-medium text-slate-900" title={value}>
                {value}
              </dd>
            </div>
          ))}
        </dl>
        {data.details.length ? (
          <dl className="grid gap-x-6 gap-y-1 border-t border-slate-100 px-5 py-3 text-[12.5px] sm:grid-cols-2">
            {data.details.map(([label, value]) => (
              <div key={label} className="flex min-w-0 gap-2">
                <dt className="shrink-0 text-slate-500">{label}:</dt>
                <dd className="truncate text-slate-800">{value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {counts.size ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-5 py-3">
            {[...counts.entries()].map(([colour, count]) => (
              <span
                key={colour}
                className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 text-[12px] font-medium text-slate-700 ring-1 ring-slate-200"
              >
                <span className={cn("size-2 rounded-full", DOT[colour])} aria-hidden />
                {count} {colourName(colour)}
              </span>
            ))}
          </div>
        ) : null}
        <ol
          aria-label="Checks undertaken"
          className="divide-y divide-slate-100 border-t border-slate-100"
        >
          {data.items.map((item, index) => (
            <li key={`${item.annexure}`}>
              <button
                type="button"
                onClick={() => jump(item.annexure)}
                className="grid w-full grid-cols-[1.75rem_minmax(0,1fr)_auto] items-center gap-3 px-5 py-3 text-left transition hover:bg-slate-50"
              >
                <span className="text-[12px] font-medium text-slate-400">{index + 1}.</span>
                <span className="min-w-0">
                  <span className="block truncate text-[13.5px] font-semibold text-slate-900">
                    {item.label}
                  </span>
                  <span className="block truncate text-[12px] text-slate-500">
                    {item.detail} · {item.status}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <ColourPill colour={item.disposition} />
                  <ChevronRight className="size-4 text-slate-300" aria-hidden />
                </span>
              </button>
            </li>
          ))}
          {!data.items.length ? (
            <li className="px-5 py-6 text-[13px] text-slate-500">No checks on this report.</li>
          ) : null}
        </ol>
      </section>

      {data.items.map((item) => {
        const meta = item.checkId ? internal.get(item.checkId) : undefined;
        return (
          <article
            key={item.annexure}
            id={`annexure-${item.annexure}`}
            aria-label={`Annexure ${roman(item.annexure)} ${item.label}`}
            className="scroll-mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white"
          >
            <header className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-slate-50/70 px-5 py-3">
              <span className="rounded-md bg-slate-900 px-2 py-1 text-[11px] font-semibold tracking-wide text-white">
                Annexure {roman(item.annexure)}
              </span>
              <h3 className="min-w-0 flex-1 text-[14px] font-semibold text-slate-900">
                {item.label}
                <span className="block text-[12px] font-normal text-slate-500">
                  {item.annexureTitle}
                </span>
              </h3>
              <ColourPill colour={item.disposition}>
                {item.disposition
                  ? `${colourName(item.disposition)} · ${item.status}`
                  : item.status}
              </ColourPill>
              {itemAction?.(item)}
            </header>
            {meta ? (
              <p className="flex flex-wrap gap-x-4 gap-y-1 border-b border-slate-100 bg-blue-50/50 px-5 py-2 text-[12px] text-slate-600">
                <span>
                  <span className="text-slate-400">Verified by</span>{" "}
                  {meta.verifiedBy || "Not recorded"}
                </span>
                {meta.team ? (
                  <span>
                    <span className="text-slate-400">Team</span> {meta.team}
                  </span>
                ) : null}
                {meta.verifiedAt ? (
                  <span>
                    <span className="text-slate-400">On</span>{" "}
                    {new Date(meta.verifiedAt).toLocaleString("en-IN", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                ) : null}
                {(meta.notes ?? []).map(([label, value]) => (
                  <span key={label} className="font-medium text-amber-700">
                    {label}: {value}
                  </span>
                ))}
              </p>
            ) : null}
            <div className="grid gap-4 p-5">
              {item.blocks.map((block, index) => (
                <Block key={index} block={block} />
              ))}
              {item.proofs.length && item.checkId ? (
                <ProofGallery
                  checkId={item.checkId}
                  title={`Annexure ${roman(item.proofAnnexure ?? item.annexure)} · ${item.proofTitle}`}
                  proofs={item.proofs}
                  start={figureStart.get(item.annexure) ?? 0}
                />
              ) : null}
            </div>
          </article>
        );
      })}
      {data.documents.length ? (
        <section
          aria-label="Documents reviewed"
          className="rounded-2xl border border-slate-200 bg-white p-5"
        >
          <h3 className="text-[13px] font-semibold text-slate-900">Documents reviewed</h3>
          <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {data.documents.map((document) => (
              <li
                key={`${document.type}-${document.name}`}
                className="flex min-w-0 items-center gap-2 text-[12.5px] text-slate-600"
              >
                <FileText className="size-3.5 shrink-0 text-slate-400" aria-hidden />
                <span className="truncate">
                  {document.type.replaceAll("_", " ").toLowerCase()} · {document.name}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

const placeholder = (value: string) =>
  ["not provided", "not disclosed", "—", ""].includes(value.trim().toLowerCase());

function Block({ block }: { block: AnnexureBlock }) {
  const table = "w-full border-collapse text-left text-[12.5px]";
  const th =
    "border-b border-slate-200 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500";
  const td = "border-b border-slate-100 px-3 py-2 align-top text-slate-800";
  const label =
    "border-b border-slate-100 bg-slate-50/70 px-3 py-2 align-top font-medium text-slate-600";
  const titleOf = (title?: string) =>
    title ? <h4 className="mb-2 text-[12.5px] font-semibold text-slate-900">{title}</h4> : null;
  const frame = "overflow-hidden rounded-xl border border-slate-200";
  switch (block.kind) {
    case "facts":
      return (
        <div>
          {titleOf(block.title)}
          <div className={frame}>
            <table className={table}>
              <tbody>
                {block.rows.map(([name, value]) => (
                  <tr key={name}>
                    <th scope="row" className={cn(label, "w-[40%]")}>
                      {name}
                    </th>
                    <td className={cn(td, placeholder(value) && "text-slate-400")}>{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    case "compare":
      return (
        <div>
          {titleOf(block.title)}
          <div className={frame}>
            <table className={table}>
              <thead className="bg-slate-50">
                <tr>
                  <th className={cn(th, "w-[34%]")}>Criteria</th>
                  <th className={th}>Details stated</th>
                  <th className={th}>Details verified</th>
                </tr>
              </thead>
              <tbody>
                {block.rows.map(([name, stated, verified]) => {
                  const differs =
                    !placeholder(stated) &&
                    !placeholder(verified) &&
                    stated.trim().toLowerCase() !== verified.trim().toLowerCase();
                  return (
                    <tr key={name}>
                      <th scope="row" className={label}>
                        {name}
                      </th>
                      <td className={cn(td, placeholder(stated) && "text-slate-400")}>{stated}</td>
                      <td
                        className={cn(
                          td,
                          placeholder(verified) && "text-slate-400",
                          differs && "font-semibold text-red-700",
                        )}
                      >
                        <span className="inline-flex flex-wrap items-center gap-1.5">
                          {verified}
                          {differs ? (
                            <span className="inline-flex items-center gap-1 rounded bg-red-50 px-1.5 py-0.5 text-[10.5px] font-semibold text-red-700 ring-1 ring-red-200">
                              <AlertTriangle className="size-3" aria-hidden /> Differs
                            </span>
                          ) : null}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      );
    case "numbered":
      return (
        <div className={frame}>
          <table className={table}>
            {block.head ? (
              <thead className="bg-slate-50">
                <tr>
                  <th className={cn(th, "w-10")}>#</th>
                  <th className={th}>{block.head[0]}</th>
                  <th className={th}>{block.head[1]}</th>
                </tr>
              </thead>
            ) : null}
            <tbody>
              {block.rows.map(([name, value], index) => (
                <tr key={name}>
                  <td className={cn(td, "w-10 text-slate-400")}>{index + 1}</td>
                  <th scope="row" className={cn(label, "w-[48%]")}>
                    {name}
                  </th>
                  <td className={cn(td, placeholder(value) && "text-slate-400")}>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "results":
      return (
        <div>
          {titleOf(block.title)}
          {block.note ? (
            <p className="mb-2 text-[12px] leading-relaxed text-slate-500">{block.note}</p>
          ) : null}
          <div className={frame}>
            <table className={table}>
              <thead className="bg-slate-50">
                <tr>
                  <th className={th}>{block.head[0]}</th>
                  <th className={cn(th, "w-[28%]")}>{block.head[1]}</th>
                  {block.head[2] ? (
                    <th className={cn(th, "w-24 text-center")}>{block.head[2]}</th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {block.groups.flatMap((group, groupIndex) => [
                  ...(group.heading
                    ? [
                        <tr key={`g-${groupIndex}`}>
                          <th
                            colSpan={block.head[2] ? 3 : 2}
                            className="border-b border-slate-100 bg-slate-50 px-3 py-1.5 text-[12px] font-semibold text-slate-700"
                          >
                            {group.heading}
                          </th>
                        </tr>,
                      ]
                    : []),
                  ...group.rows.map((row, rowIndex) => (
                    <tr key={`${groupIndex}-${rowIndex}`}>
                      <td className={td}>
                        <span className="font-medium">{row.name}</span>
                        {row.detail ? (
                          <span className="mt-0.5 block text-[11.5px] leading-relaxed text-slate-500">
                            {row.detail}
                          </span>
                        ) : null}
                      </td>
                      <td
                        className={cn(
                          td,
                          !block.head[2] && row.colour === "RED" && "font-semibold text-red-700",
                        )}
                      >
                        {row.result}
                      </td>
                      {block.head[2] ? (
                        <td className={cn(td, "text-center")}>
                          <ColourPill colour={row.colour ?? null}>
                            {row.colour ? undefined : "—"}
                          </ColourPill>
                        </td>
                      ) : null}
                    </tr>
                  )),
                ])}
              </tbody>
            </table>
          </div>
        </div>
      );
    case "note":
      return (
        <div>
          {titleOf(block.title)}
          <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[12.5px] leading-relaxed text-slate-700">
            {block.text}
          </p>
        </div>
      );
  }
}

function ProofGallery({
  checkId,
  title,
  proofs,
  start,
}: {
  checkId: string;
  title: string;
  proofs: ReportViewItem["proofs"];
  start: number;
}) {
  return (
    <section aria-label="Proof">
      <h4 className="mb-2 text-[12.5px] font-semibold text-slate-900">{title}</h4>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {proofs.map((proof, index) => (
          <ProofThumb key={proof.id} checkId={checkId} proof={proof} figure={start + index + 1} />
        ))}
      </ul>
    </section>
  );
}

function ProofThumb({
  checkId,
  proof,
  figure,
}: {
  checkId: string;
  proof: ReportViewItem["proofs"][number];
  figure: number;
}) {
  const image = proof.contentType.startsWith("image/");
  const blob = useQuery({
    queryKey: ["check-evidence", checkId, proof.id, "thumb"],
    queryFn: () => checkEvidenceApi.blob(checkId, proof.id),
    enabled: image,
    staleTime: Infinity,
  });
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!blob.data) return;
    const next = URL.createObjectURL(blob.data);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [blob.data]);
  return (
    <li>
      <button
        type="button"
        onClick={() =>
          void checkEvidenceApi
            .open(checkId, proof.id)
            .catch((error: Error) => toast.error(error.message))
        }
        aria-label={`Open proof ${proof.caption || proof.name}`}
        className="group grid w-full overflow-hidden rounded-xl border border-slate-200 bg-white text-left transition hover:border-blue-300 hover:shadow-sm"
      >
        <span className="grid h-28 place-items-center bg-slate-50 text-slate-400">
          {image && url ? (
            <img src={url} alt="" className="h-full w-full object-cover object-top" />
          ) : image ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <FileText className="size-8" aria-hidden />
          )}
        </span>
        <span className="grid gap-0.5 px-2.5 py-2">
          <span className="text-[11px] font-semibold text-slate-400">Figure {figure}</span>
          <span className="line-clamp-2 text-[12px] font-medium text-slate-800">
            {proof.caption || proof.name}
          </span>
        </span>
      </button>
    </li>
  );
}
