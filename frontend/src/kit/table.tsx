import type { ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function TableWrap({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "overflow-x-auto rounded-lg border border-line bg-surface shadow-soft",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Table({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <table aria-label={label} className="w-full border-collapse text-sm">
      {children}
    </table>
  );
}

export function Th({
  align = "left",
  className,
  children,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement> & { align?: "left" | "right" }) {
  return (
    <th
      scope="col"
      className={cn(
        "border-b border-line bg-subtle/50 px-3 py-2.5 text-[11px] font-semibold tracking-wider whitespace-nowrap text-dim uppercase",
        align === "right" ? "text-right" : "text-left",
        className,
      )}
      {...props}
    >
      {children}
    </th>
  );
}

export function Td({
  align = "left",
  mono = false,
  className,
  children,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement> & { align?: "left" | "right"; mono?: boolean }) {
  return (
    <td
      className={cn(
        "border-b border-line px-3 py-2.5 align-middle",
        align === "right" && "text-right",
        mono && "font-mono tabular-nums",
        className,
      )}
      {...props}
    >
      {children}
    </td>
  );
}

/** A whole row that opens something: clickable and keyboard reachable. */
export function ClickRow({
  onOpen,
  label,
  children,
}: {
  onOpen: () => void;
  label?: string;
  children: ReactNode;
}) {
  return (
    <tr
      tabIndex={0}
      aria-label={label}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter") onOpen();
      }}
      className="cursor-pointer last:[&>td]:border-b-0 hover:bg-subtle/70 focus:bg-subtle focus:outline-none"
    >
      {children}
    </tr>
  );
}

export function Row({ children }: { children: ReactNode }) {
  return <tr className="last:[&>td]:border-b-0 hover:bg-subtle/40">{children}</tr>;
}

export function EmptyRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-10 text-center text-sm text-dim">
        {children}
      </td>
    </tr>
  );
}
