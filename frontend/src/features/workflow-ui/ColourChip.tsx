import { colourClass, dispositionMeta, type Disposition } from "./colour-codes";

/** Colour code with its label, so the meaning never depends on colour alone. */
export function ColourChip({
  value,
  compact = false,
}: {
  value: Disposition | null;
  compact?: boolean;
}) {
  if (!value) return null;
  const meta = dispositionMeta[value];
  return (
    <span className={`colour-chip ${colourClass(value)}`} title={meta.hint}>
      <i aria-hidden />
      {compact ? meta.short : meta.label}
    </span>
  );
}
