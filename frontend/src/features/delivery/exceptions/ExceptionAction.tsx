import type { ReactNode } from "react";

export function ExceptionAction({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="rounded-lg border border-slate-200 bg-white p-2 hover:bg-slate-50"
    >
      {children}
    </button>
  );
}
