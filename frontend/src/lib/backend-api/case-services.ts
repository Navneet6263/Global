export interface CaseServiceScope {
  publicId: string;
  serviceFamily: string;
  tatHours: number;
  requiredDocuments: string[];
  servicePackage: { publicId: string; code: string; name: string };
  checks: Array<{
    publicId: string;
    type: string;
    status: string;
    result?: string | null;
    dueAt?: string | null;
  }>;
}

export function casePackageName(row: {
  services?: CaseServiceScope[];
  servicePackage?: { name: string } | null;
}) {
  return row.services?.length
    ? row.services.map((service) => service.servicePackage.name).join(" + ")
    : (row.servicePackage?.name ?? null);
}
