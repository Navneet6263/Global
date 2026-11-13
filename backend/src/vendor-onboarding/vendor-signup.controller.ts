import {
  Body,
  Controller,
  Headers,
  Ip,
  Post,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Public } from "../common/auth/auth.decorators";
import type { RequestMeta } from "../auth/auth.types";
import {
  VendorSignupResendDto,
  VendorSignupStartDto,
  VendorSignupVerifyDto,
} from "./dto/vendor-onboarding.dto";
import { VendorSignupService } from "./vendor-signup.service";

@Public()
@Controller("auth/vendor/signup")
export class VendorSignupController {
  constructor(private readonly signup: VendorSignupService) {}

  @Post("start")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  start(
    @Body() input: VendorSignupStartDto,
    @Ip() ipAddress?: string,
    @Headers("user-agent") userAgent?: string,
  ) {
    const meta: RequestMeta = { ipAddress, userAgent };
    return this.signup.start(input, meta);
  }

  @Post("resend")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  resend(@Body() input: VendorSignupResendDto) {
    return this.signup.resend(input.signupId);
  }

  @Post("verify")
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  verify(
    @Body() input: VendorSignupVerifyDto,
    @Ip() ipAddress?: string,
    @Headers("user-agent") userAgent?: string,
  ) {
    const meta: RequestMeta = { ipAddress, userAgent };
    return this.signup.verify(input.signupId, input.otp, meta);
  }
}
