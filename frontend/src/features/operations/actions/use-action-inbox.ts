import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/backend-api/client";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import type { ActionInboxData, ActionInboxSearch } from "./action-inbox-model";

export function useActionInbox(search: ActionInboxSearch) {
  const text = useDebouncedValue(search.q?.trim() ?? "");
  const input = { action: search.action ?? "documents", page: search.page ?? 1, search: text };
  return useQuery({
    queryKey: ["operations", "action-inbox", input],
    queryFn: ({ signal }) =>
      apiRequest<ActionInboxData>(
        `/dashboards/operations/actions?${new URLSearchParams({
          action: input.action,
          page: String(input.page),
          pageSize: "8",
          search: text,
        })}`,
        { signal },
      ),
    enabled: text === (search.q?.trim() ?? ""),
    staleTime: 10_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
}
