import type { Actor } from "../../src/common/auth/actor";
import { testActor } from "./test-actor";

/** Clients A, B, C are assigned to the SPOC-RM below; D never is. */
export const A = "0f8fad5b-d9cb-469f-a165-70867728950e";
export const B = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
export const C = "5f0c3c1e-7d0b-4f5e-9d8a-2b1c3d4e5f60";
export const D = "3b241101-e2bb-4255-8caf-4136c566a962";
export const DOC = "33333333-3333-4333-8333-333333333333";
export const REQ = "55555555-5555-4555-8555-555555555555";

export function spocActor(roles: string[], extra: Partial<Actor> = {}): Actor {
  return testActor(
    roles,
    roles.includes("PLATFORM_ADMIN") ? ["*"] : ["vendor:assign"],
    { email: "spoc@sapling.example", displayName: "SPOC", ...extra },
  );
}

export const assigned = [
  { id: 41n, publicId: A, name: "Client A" },
  { id: 42n, publicId: B, name: "Client B" },
  { id: 43n, publicId: C, name: "Client C" },
];
export const spocABC = spocActor(["SPOC_RM"], { spocClients: assigned });
export const admin = spocActor(["PLATFORM_ADMIN"]);
