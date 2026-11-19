import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils";

export const inputClass =
  "h-9 w-full rounded-md border border-line bg-surface px-3 text-sm text-ink placeholder:text-dim/70 focus:border-brand/70 focus:ring-3 focus:ring-brand/15 focus:outline-none disabled:bg-subtle disabled:text-dim";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(inputClass, className)} {...props} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <select ref={ref} className={cn(inputClass, "pr-8", className)} {...props}>
        {children}
      </select>
    );
  },
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(inputClass, "h-auto min-h-[84px] resize-y py-2", className)}
      {...props}
    />
  );
});

export function FieldError({ text }: { text?: string | null }) {
  return text ? (
    <p role="alert" className="mt-1 text-xs text-bad">
      {text}
    </p>
  ) : null;
}

export function Hint({ children }: { children?: ReactNode }) {
  return children ? <p className="mt-1 text-xs text-dim">{children}</p> : null;
}

/** Label above the control: filters and short forms. */
export function Field({
  label,
  htmlFor,
  error,
  hint,
  required = false,
  className,
  children,
}: {
  label: ReactNode;
  htmlFor?: string;
  error?: string | null;
  hint?: ReactNode;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <label htmlFor={htmlFor} className="text-xs font-medium text-dim">
        {label}
        {required ? <span className="ml-0.5 text-bad">*</span> : null}
      </label>
      {children}
      <Hint>{hint}</Hint>
      <FieldError text={error} />
    </div>
  );
}
