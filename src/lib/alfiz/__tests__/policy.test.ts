import { createApplication, memoryDriver } from "@alfiz/application";
import { createAlfizClient } from "@alfiz/core";
import { beforeEach, describe, expect, it } from "vitest";
import { BUILTIN_ROLES, catalog } from "../catalog";

/** The shipped catalog + built-in roles, set up the way lib/alfiz/app.ts bootstraps production. */
const P = { kind: "system" as const, note: "test" };
const route = "bj.route:r1" as const;

function setup() {
  const app = createApplication({ catalog, storage: memoryDriver() });
  const alfiz = createAlfizClient({ catalog, provider: app });
  return { app, alfiz };
}

let app: ReturnType<typeof setup>["app"];
let alfiz: ReturnType<typeof setup>["alfiz"];

beforeEach(async () => {
  ({ app, alfiz } = setup());
  for (const role of BUILTIN_ROLES) await app.createRole({ ...role, patterns: [...role.patterns] }, P);
  await app.createGrant({ subject: "everyone", roleId: "bj-member", provenance: P });
  await app.createGrant({ subject: "user:dev:mod", roleId: "bj-moderator", provenance: P });
});

const anyone = { userId: "dev:someone" };
const anonymous = { userId: "anonymous" };
const moderator = { userId: "dev:mod" };

describe("members (everyone)", () => {
  it("can read, share, and count activity, signed in or not", async () => {
    for (const who of [anyone, anonymous]) {
      expect(await alfiz.can(who, "bj.routes.read")).toBe(true);
      expect(await alfiz.can(who, "bj.routes.create")).toBe(true);
      expect(await alfiz.can(who, "bj.routes.record_activity")).toBe(true);
    }
  });

  it("manage only their own routes", async () => {
    expect(await alfiz.can(anyone, "bj.routes.update_own", route, { condition: () => true })).toBe(true);
    expect(await alfiz.can(anyone, "bj.routes.update_own", route, { condition: () => false })).toBe(false);
    expect(await alfiz.can.fresh(anyone, "bj.routes.delete_own", route, { condition: () => true })).toBe(true);
    expect(await alfiz.can(anyone, "bj.routes.update", route)).toBe(false);
    expect(await alfiz.can.fresh(anyone, "bj.routes.delete", route)).toBe(false);
  });

  it("can't skip the ownership condition", async () => {
    await expect(alfiz.can(anyone, "bj.routes.update_own", route)).rejects.toThrow(/condition/i);
  });
});

describe("moderators", () => {
  it("edit and delete any route", async () => {
    expect(await alfiz.can(moderator, "bj.routes.update", route)).toBe(true);
    expect(await alfiz.can.fresh(moderator, "bj.routes.delete", route)).toBe(true);
  });
});

describe("revocation", () => {
  it("a personal revoke beats the everyone grant", async () => {
    await app.createRevoke({ userId: "dev:someone", pattern: "bj.routes.create", provenance: P });
    expect(await alfiz.can.fresh(anyone, "bj.routes.create")).toBe(false);
    expect(await alfiz.can.fresh(moderator, "bj.routes.create")).toBe(true);
  });
});
