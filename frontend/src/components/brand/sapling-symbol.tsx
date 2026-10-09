import type { ComponentProps } from "react";

/** Square mark (hands + leaf) cut from the Sapling Global wordmark; favicon and tight spots. */
export function SaplingSymbol({ className, alt = "" }: ComponentProps<"img">) {
  return <img src="/brand/sapling-icon.png" alt={alt} className={className} draggable={false} />;
}
