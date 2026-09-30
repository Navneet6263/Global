import { useInfiniteQuery } from "@tanstack/react-query";
import { vendorKeys } from "../use-vendor-requests";
import { listVendorLogs } from "./vendor-logs-api";

export function useVendorLogs(requestId: string | undefined) {
  return useInfiniteQuery({
    queryKey: [...vendorKeys.all, "logs", requestId ?? "all"] as const,
    queryFn: ({ pageParam, signal }) => listVendorLogs({ cursor: pageParam, requestId }, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}
