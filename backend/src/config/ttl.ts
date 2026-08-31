export function ttlSeconds(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value);
  if (!match) throw new Error("TTL must use an integer followed by s, m, h or d");
  const amount = Number(match[1]);
  const multiplier = {
    s: 1,
    m: 60,
    h: 3_600,
    d: 86_400,
  }[match[2] as "s" | "m" | "h" | "d"];
  return amount * multiplier;
}
