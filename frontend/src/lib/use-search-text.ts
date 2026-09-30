import { useEffect, useState } from "react";
import { useDebouncedValue } from "./use-debounced-value";

/** A search box bound to a URL param: typed text is committed after a short pause. */
export function useSearchText(current: string | undefined, commit: (value?: string) => void) {
  const [text, setText] = useState(current ?? "");
  const debounced = useDebouncedValue(text.trim());
  useEffect(() => {
    if (debounced !== (current ?? "")) commit(debounced || undefined);
  }, [debounced, current, commit]);
  return [text, setText] as const;
}
