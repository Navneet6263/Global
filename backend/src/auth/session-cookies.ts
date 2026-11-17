import { randomUUID } from "node:crypto";
import type { ConfigService } from "@nestjs/config";
import type { FastifyReply, FastifyRequest } from "fastify";
import { ttlSeconds } from "../config/ttl";
import type { RequestMeta } from "./auth.types";

/**
 * Session cookies shared by every sign-in path (password login, company sign-up and
 * vendor sign-up), so a new account is signed in the same way and tokens never travel
 * in a response body.
 */
export function setSessionCookies(
  config: Pick<ConfigService, "get">,
  response: FastifyReply,
  tokens: { accessToken: string; refreshToken: string; refreshExpiresAt: Date },
): void {
  const secure = config.get<boolean>("COOKIE_SECURE", false) ?? false;
  response.setCookie("sg_access", tokens.accessToken, {
    httpOnly: true,
    secure,
    sameSite: "strict",
    path: "/",
    maxAge: ttlSeconds(config.get<string>("JWT_ACCESS_TTL", "15m") ?? "15m"),
  });
  response.setCookie("sg_refresh", tokens.refreshToken, {
    httpOnly: true,
    secure,
    sameSite: "strict",
    path: "/api/v1/auth",
    expires: tokens.refreshExpiresAt,
  });
  // Readable "signed in" marker (no secret): lets the web app skip the session
  // check when nobody is signed in, instead of logging 401s on every visit.
  response.setCookie("sg_session", "1", {
    httpOnly: false,
    secure,
    sameSite: "strict",
    path: "/",
    expires: tokens.refreshExpiresAt,
  });
}

export function clearSessionHint(response: FastifyReply): void {
  response.clearCookie("sg_session", { path: "/" });
}

/** IP, browser and (when a proxy provides it) city of the request, for the audit log. */
export function requestMeta(
  request: FastifyRequest,
  deviceKey?: string,
): RequestMeta {
  const header = (name: string) => {
    const value = request.headers[name];
    return Array.isArray(value) ? value[0] : value;
  };
  const city = header("cf-ipcity") ?? header("x-vercel-ip-city");
  const region = header("cf-region") ?? header("x-vercel-ip-country-region");
  const country = header("cf-ipcountry") ?? header("x-vercel-ip-country");
  return {
    ipAddress: request.ip,
    userAgent: request.headers["user-agent"],
    deviceKey,
    locationLabel:
      [city, region, country].filter(Boolean).join(", ") || undefined,
  };
}

/** The browser's long-lived device id (new devices are flagged on sign-in). */
export function ensureDeviceKey(
  config: Pick<ConfigService, "get">,
  request: FastifyRequest,
  response: FastifyReply,
): string {
  const existing = (request.cookies as Record<string, string> | undefined)
    ?.sg_device;
  const deviceKey =
    existing && /^[0-9a-f-]{36}$/i.test(existing) ? existing : randomUUID();
  response.setCookie("sg_device", deviceKey, {
    httpOnly: true,
    secure: config.get<boolean>("COOKIE_SECURE", false) ?? false,
    sameSite: "strict",
    path: "/",
    maxAge: 365 * 24 * 60 * 60,
  });
  return deviceKey;
}
