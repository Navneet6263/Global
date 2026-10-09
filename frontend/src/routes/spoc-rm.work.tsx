import { useQueryClient, useIsFetching } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { rmBuckets, type RmBucket } from "@/lib/backend-api/workflow";
import { RmWorkQueue, type RmQueueSearch } from "@/features/workflow-ui/RmWorkQueue";
import { PAGE_SIZES } from "@/features/workflow-ui/rm-queue-model";

const UUID = /^[0-9a-f-]{36}$/i;

export const Route = createFileRoute("/spoc-rm/work")({
  validateSearch: (input: Record<string, unknown>): RmQueueSearch => {
    const page = Number(input["page"]);
    const size = Number(input["size"]);
    const q = typeof input["q"] === "string" ? input["q"].trim().slice(0, 120) : "";
    return {
      bucket: rmBuckets.some((bucket) => bucket.value === input["bucket"])
        ? (input["bucket"] as RmBucket)
        : undefined,
      q: q || undefined,
      page: Number.isSafeInteger(page) && page > 1 && page <= 100_000 ? page : undefined,
      caseId:
        typeof input["caseId"] === "string" && /^[A-Za-z0-9-]{1,64}$/.test(input["caseId"])
          ? input["caseId"]
          : undefined,
      client:
        typeof input["client"] === "string" && UUID.test(input["client"])
          ? input["client"]
          : undefined,
      sort: input["sort"] === "newest" ? "newest" : undefined,
      flag:
        input["flag"] === "escalated" || input["flag"] === "overdue" ? input["flag"] : undefined,
      size: (PAGE_SIZES as readonly number[]).includes(size) && size !== 10 ? size : undefined,
    };
  },
  head: () => ({ meta: [{ title: "My work — Sapling Global RM" }] }),
  component: RmWorkPage,
});

function RmWorkPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const queryClient = useQueryClient();
  const refreshing = useIsFetching({ queryKey: ["workflow", "rm-queue"] }) > 0;
  return (
    <>
      <header className="client-heading">
        <div>
          <h1>My work overview</h1>
          <p>Your clients. Every handover. The next decision.</p>
        </div>
        <div className="client-heading-actions">
          <Button
            variant="outline"
            onClick={() =>
              void queryClient.invalidateQueries({ queryKey: ["workflow", "rm-queue"] })
            }
            loading={refreshing}
          >
            <RefreshCw className="size-4" aria-hidden /> Refresh
          </Button>
        </div>
      </header>
      <RmWorkQueue
        search={search}
        onChange={(patch, replace) =>
          void navigate({
            search: (current) => ({ ...current, ...patch }),
            replace,
            resetScroll: false,
          })
        }
      />
    </>
  );
}
