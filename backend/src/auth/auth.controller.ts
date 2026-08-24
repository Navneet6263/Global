import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { FastifyReply, FastifyRequest } from "fastify";
import {
  AllowPasswordChangePending,
  CurrentActor,
  Public,
} from "../common/auth/auth.decorators";
import type { Actor } from "../common/auth/actor";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { ChangePasswordDto } from "./dto/change-password.dto";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("login")
  async login(
    @Body() input: LoginDto,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) response: FastifyReply,
  ) {
    const tokens = await this.auth.login(input, this.meta(request));
    this.setCookies(response, tokens);
    return { authenticated: true };
  }

  @Public()
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  @Post("refresh")
  async refresh(
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) response: FastifyReply,
  ) {
    const token = (request.cookies as Record<string, string> | undefined)
      ?.sg_refresh;
    if (!token) throw new UnauthorizedException("Refresh cookie is missing");
    const tokens = await this.auth.refresh(token, this.meta(request));
    this.setCookies(response, tokens);
    return { authenticated: true };
  }

  @Public()
  @Post("logout")
  async logout(
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) response: FastifyReply,
  ) {
    const token = (request.cookies as Record<string, string> | undefined)
      ?.sg_refresh;
    await this.auth.revoke(token);
    response.clearCookie("sg_access", { path: "/" });
    response.clearCookie("sg_refresh", { path: "/api/v1/auth" });
    return { authenticated: false };
  }

  @Get("me")
  @AllowPasswordChangePending()
  me(@CurrentActor() actor: Actor) {
    return this.auth.profile(actor);
  }

  @Get("sessions")
  sessions(@CurrentActor() actor: Actor) {
    return this.auth.sessions(actor);
  }

  @Delete("sessions/others")
  revokeOtherSessions(@CurrentActor() actor: Actor) {
    return this.auth.revokeOtherSessions(actor);
  }

  @Delete("sessions/:sessionId")
  async revokeSession(
    @CurrentActor() actor: Actor,
    @Param("sessionId", ParseUUIDPipe) sessionId: string,
    @Res({ passthrough: true }) response: FastifyReply,
  ) {
    const result = await this.auth.revokeSession(actor, sessionId);
    if (result.current) {
      response.clearCookie("sg_access", { path: "/" });
      response.clearCookie("sg_refresh", { path: "/api/v1/auth" });
    }
    return result;
  }

  @Post("change-password")
  @AllowPasswordChangePending()
  changePassword(
    @CurrentActor() actor: Actor,
    @Body() input: ChangePasswordDto,
  ) {
    return this.auth.changePassword(actor, input);
  }

  private setCookies(
    response: FastifyReply,
    tokens: {
      accessToken: string;
      refreshToken: string;
      refreshExpiresAt: Date;
    },
  ): void {
    const secure = process.env.COOKIE_SECURE === "true";
    response.setCookie("sg_access", tokens.accessToken, {
      httpOnly: true,
      secure,
      sameSite: "strict",
      path: "/",
      maxAge: 15 * 60,
    });
    response.setCookie("sg_refresh", tokens.refreshToken, {
      httpOnly: true,
      secure,
      sameSite: "strict",
      path: "/api/v1/auth",
      expires: tokens.refreshExpiresAt,
    });
  }

  private meta(request: FastifyRequest) {
    return { ipAddress: request.ip, userAgent: request.headers["user-agent"] };
  }
}
