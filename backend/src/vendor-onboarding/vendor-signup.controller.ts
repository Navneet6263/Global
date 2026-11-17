import { Body, Controller, Post, Req, Res } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Throttle } from "@nestjs/throttler";
import type { FastifyReply, FastifyRequest } from "fastify";
import { Public } from "../common/auth/auth.decorators";
import {
  ensureDeviceKey,
  requestMeta,
  setSessionCookies,
} from "../auth/session-cookies";
import {
  VendorSignupResendDto,
  VendorSignupStartDto,
  VendorSignupVerifyDto,
} from "./dto/vendor-onboarding.dto";
import { VendorSignupService } from "./vendor-signup.service";

/** Vendor self sign-up: details, then the emailed code signs the vendor in (cookies). */
@Public()
@Controller("auth/vendor/signup")
export class VendorSignupController {
  constructor(
    private readonly signup: VendorSignupService,
    private readonly config: ConfigService,
  ) {}

  @Post("start")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  start(@Body() input: VendorSignupStartDto, @Req() request: FastifyRequest) {
    return this.signup.start(input, requestMeta(request));
  }

  @Post("resend")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  resend(@Body() input: VendorSignupResendDto) {
    return this.signup.resend(input.signupId);
  }

  /** Same as company sign-up: session cookies are set and no token is returned. */
  @Post("verify")
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async verify(
    @Body() input: VendorSignupVerifyDto,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) response: FastifyReply,
  ) {
    const deviceKey = ensureDeviceKey(this.config, request, response);
    const result = await this.signup.verify(
      input.signupId,
      input.otp,
      requestMeta(request, deviceKey),
    );
    setSessionCookies(this.config, response, result.tokens);
    return { authenticated: true, session: result.session };
  }
}
