import "reflect-metadata";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Actor } from "../../src/common/auth/actor";
import { PermissionsGuard } from "../../src/common/auth/permissions.guard";

/** Whether the real PermissionsGuard lets `who` call `controller.prototype[method]`. */
export function passesGuard(
  controller: object,
  method: string,
  who: Actor,
): boolean {
  const target = controller as { prototype: Record<string, unknown> };
  const context = {
    getHandler: () => target.prototype[method],
    getClass: () => controller,
    switchToHttp: () => ({ getRequest: () => ({ user: who }) }),
  } as unknown as ExecutionContext;
  try {
    return Boolean(new PermissionsGuard(new Reflector()).canActivate(context));
  } catch {
    return false;
  }
}

export interface ControllerHandler {
  file: string;
  name: string;
  controller: object;
  method: string;
  handler: object;
}

/** Every handler of every *.controller.ts under src, for route-wide access checks. */
export async function allControllerHandlers(): Promise<ControllerHandler[]> {
  const files: string[] = [];
  const walk = (dir: string) =>
    readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith(".controller.ts")) files.push(path);
    });
  walk(join(__dirname, "../../src"));
  const handlers: ControllerHandler[] = [];
  for (const file of files) {
    const exported = (await import(pathToFileURL(file).href)) as Record<
      string,
      unknown
    >;
    for (const [name, value] of Object.entries(exported)) {
      if (typeof value !== "function") continue;
      const prototype = (value.prototype ?? {}) as Record<string, unknown>;
      for (const method of Object.getOwnPropertyNames(prototype)) {
        const handler = prototype[method];
        if (method !== "constructor" && typeof handler === "function")
          handlers.push({ file, name, controller: value, method, handler });
      }
    }
  }
  return handlers;
}
