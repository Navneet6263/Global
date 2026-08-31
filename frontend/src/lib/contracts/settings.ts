export interface OrganisationSettings {
  id: string;
  name: string;
  timezone: string;
  status: string;
}

export interface Branch {
  id: string;
  code: string;
  name: string;
  city: string;
  fieldExecutives: number;
  status: "active" | "paused";
}

export interface ServicePackage {
  id: string;
  name: string;
  checks: number;
  tatHours: number;
  unitPrice: number | null;
  status: "published" | "draft";
}

export interface PolicyToggle {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
}

export interface SlaDefault {
  id: string;
  checkLabel: string;
  standardHours: number;
}

export interface RetentionRule {
  id: string;
  dataClass: string;
  retentionDays: number;
}

export interface PlatformSettings {
  organisation: OrganisationSettings;
  branches: readonly Branch[];
  packages: readonly ServicePackage[];
  fieldPolicy: readonly PolicyToggle[];
  fieldPolicyConfig: {
    defaultRadiusMeters: number;
    maxAccuracyMeters: number;
    minimumPhotos: number;
    retentionDays: number;
    requireCheckout: boolean;
    outsideGeofencePolicy: "BLOCK" | "SUPERVISOR_APPROVAL" | "ALLOW_AND_FLAG";
    version: number;
  };
  evidencePolicy: readonly PolicyToggle[];
  slaDefaults: readonly SlaDefault[];
  retention: readonly RetentionRule[];
}
