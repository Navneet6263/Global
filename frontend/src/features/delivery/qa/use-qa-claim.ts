import { useEffect, useState } from "react";
import type { QaQueueItem } from "@/lib/api/qa";

export function useQaClaim(item: QaQueueItem, reviewerId?: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 10_000);
    return () => window.clearInterval(timer);
  }, []);
  const expires = item.qaClaimedAt ? Date.parse(item.qaClaimedAt) + 30 * 60_000 : 0;
  const active = expires > now;
  return {
    active,
    mine: active && Boolean(reviewerId) && item.qaReviewer?.publicId === reviewerId,
    minutes: Math.max(0, Math.ceil((expires - now) / 60_000)),
  };
}
