export type TeamMemberStatus = "ACTIVE" | "SUSPENDED";

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: TeamMemberStatus;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  version: number;
  /** Pending requests currently delegated to this team user. */
  pendingRequests: number;
}

/** GET /vendor/team: a Main Vendor sees its team; a team user sees who manages it. */
export interface VendorTeamOverview {
  role: "OWNER" | "MEMBER";
  managedBy: string | null;
  limit: number;
  active: number;
  remaining: number;
  members: TeamMember[];
}

export interface CreateTeamUserInput {
  fullName: string;
  email: string;
  mobile?: string;
}
