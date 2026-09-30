import { IsInt, Max, Min } from "class-validator";
import { VENDOR_TEAM_MAX_LIMIT } from "../../vendor-requests/services/vendor-team-rules";

export class UpdateVendorTeamLimitDto {
  /** Maximum ACTIVE team logins this Main Vendor may have (0 disables team users). */
  @IsInt()
  @Min(0)
  @Max(VENDOR_TEAM_MAX_LIMIT)
  maxActiveUsers!: number;

  /** The policy version the admin was looking at; 0 when the vendor has no policy yet. */
  @IsInt()
  @Min(0)
  version!: number;
}
