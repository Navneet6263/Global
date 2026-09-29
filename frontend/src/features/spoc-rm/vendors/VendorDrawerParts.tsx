import type { ReactNode } from "react";

/** Titled block inside the SPOC-RM vendor drawer. */
export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
        {title}
      </h3>
      {children}
    </section>
  );
}

/** One labelled value in a drawer fact grid. */
export function Fact({ term, value }: { term: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] text-muted-foreground">{term}</dt>
      <dd className="mt-0.5 break-words font-medium text-foreground">{value}</dd>
    </div>
  );
}
