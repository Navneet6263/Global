import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RmQueueSearch } from "./RmWorkQueue";
import { PAGE_SIZES } from "./rm-queue-model";

export function RmQueueFooter({
  page,
  pages,
  size,
  total,
  onChange,
}: {
  page: number;
  pages: number;
  size: number;
  total: number;
  onChange: (patch: Partial<RmQueueSearch>, replace?: boolean) => void;
}) {
  return (
    <footer className="rmo-pager">
      <span>
        {total
          ? `Showing ${(page - 1) * size + 1}–${Math.min(total, page * size)} of ${total}`
          : ""}
      </span>
      <div>
        <Button
          variant="outline"
          size="icon"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onChange({ page: page - 1 })}
        >
          <ChevronLeft aria-hidden />
        </Button>
        <span className="rmo-page">
          {page} / {pages}
        </span>
        <Button
          variant="outline"
          size="icon"
          aria-label="Next page"
          disabled={page >= pages}
          onClick={() => onChange({ page: page + 1 })}
        >
          <ChevronRight aria-hidden />
        </Button>
        <select
          aria-label="Rows per page"
          value={size}
          onChange={(event) =>
            onChange({
              size: Number(event.target.value) === 10 ? undefined : Number(event.target.value),
              page: undefined,
            })
          }
        >
          {PAGE_SIZES.map((value) => (
            <option key={value} value={value}>
              {value} per page
            </option>
          ))}
        </select>
      </div>
    </footer>
  );
}
