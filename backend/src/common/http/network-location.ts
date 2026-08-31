function normalizedIp(value?: string | null): string {
  return (value ?? "").trim().replace(/^::ffff:/, "");
}

export function networkLocationLabel(
  ipAddress?: string | null,
  trustedLocation?: string | null,
): string {
  const supplied = trustedLocation?.trim().slice(0, 160);
  if (supplied) return supplied;
  const ip = normalizedIp(ipAddress);
  if (!ip) return "Location unavailable";
  if (ip === "127.0.0.1" || ip === "::1") return "Local device";
  if (
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ||
    ip.startsWith("fc") ||
    ip.startsWith("fd") ||
    ip.startsWith("fe80:")
  ) {
    return "Internal network";
  }
  return "Approximate location unavailable";
}
