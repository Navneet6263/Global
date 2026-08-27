export interface OrganisationSettings {
  legalName: string;
  brandName: string;
  gstin: string;
  registeredAddress: string;
  supportEmail: string;
  supportPhone: string;
  timezoneLabel: string;
}

export interface Branch {
  id: string;
  name: string;
  city: string;
  state: string;
  headOfBranch: string;
  fieldExecutives: number;
  status: "active" | "paused";
}

export interface ServicePackage {
  id: string;
  name: string;
  checks: number;
  slaDays: number;
  unitPrice: number;
  clientsUsing: number;
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
  escalationHours: number;
}

export interface RetentionRule {
  id: string;
  dataClass: string;
  retentionMonths: number;
  disposalMethod: string;
}

export interface NotificationPreference {
  id: string;
  channel: "email" | "sms" | "whatsapp" | "in_app";
  event: string;
  enabled: boolean;
}

export interface PlatformSettings {
  organisation: OrganisationSettings;
  branches: readonly Branch[];
  packages: readonly ServicePackage[];
  fieldPolicy: readonly PolicyToggle[];
  evidencePolicy: readonly PolicyToggle[];
  slaDefaults: readonly SlaDefault[];
  retention: readonly RetentionRule[];
  notifications: readonly NotificationPreference[];
  clientAdministration: readonly PolicyToggle[];
}
