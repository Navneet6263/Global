export function reportDownloadLifetimeDays(): number {
  const days = Number(process.env.REPORT_DOWNLOAD_TTL_DAYS ?? 30);
  if (!Number.isInteger(days) || days < 1 || days > 3650) {
    throw new Error(
      "REPORT_DOWNLOAD_TTL_DAYS must be an integer from 1 to 3650",
    );
  }
  return days;
}

export function reportDownloadExpiry(now = new Date()): Date {
  return new Date(now.getTime() + reportDownloadLifetimeDays() * 86_400_000);
}
