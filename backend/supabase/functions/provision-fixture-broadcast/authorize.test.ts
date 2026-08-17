import { strict as assert } from "node:assert";
import { decodeJwtPayload, isAuthorizedToProvision } from "./authorize.ts";

function fakeJwt(payload: Record<string, unknown>): string {
  const base64url = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, "-").replace(/\//g, "_").replace(
      /=+$/,
      "",
    );
  return `${base64url({ alg: "HS256" })}.${base64url(payload)}.fake-signature`;
}

Deno.test("decodeJwtPayload reads the payload of a well-formed JWT", () => {
  const jwt = fakeJwt({ role: "service_role", iss: "supabase" });
  assert.deepEqual(decodeJwtPayload(jwt), {
    role: "service_role",
    iss: "supabase",
  });
});

Deno.test("decodeJwtPayload returns null for garbage input instead of throwing", () => {
  assert.equal(decodeJwtPayload("not-a-jwt"), null);
  assert.equal(decodeJwtPayload(""), null);
  assert.equal(decodeJwtPayload("a.b"), null);
});

Deno.test("service_role is always authorized, regardless of profile", () => {
  assert.equal(
    isAuthorizedToProvision({
      jwtRole: "service_role",
      profile: null,
      fixtureHostSchoolId: "s1",
    }),
    true,
  );
});

Deno.test("a platform_admin is authorized for any school's fixture", () => {
  assert.equal(
    isAuthorizedToProvision({
      jwtRole: "authenticated",
      profile: { role: "platform_admin", schoolId: null },
      fixtureHostSchoolId: "s1",
    }),
    true,
  );
});

Deno.test("a school_operator is authorized only for their own school's fixture", () => {
  assert.equal(
    isAuthorizedToProvision({
      jwtRole: "authenticated",
      profile: { role: "school_operator", schoolId: "s1" },
      fixtureHostSchoolId: "s1",
    }),
    true,
  );
  assert.equal(
    isAuthorizedToProvision({
      jwtRole: "authenticated",
      profile: { role: "school_operator", schoolId: "s2" },
      fixtureHostSchoolId: "s1",
    }),
    false,
  );
});

Deno.test("a parent is never authorized", () => {
  assert.equal(
    isAuthorizedToProvision({
      jwtRole: "authenticated",
      profile: { role: "parent", schoolId: null },
      fixtureHostSchoolId: "s1",
    }),
    false,
  );
});

Deno.test("no profile at all (e.g. lookup failed) is never authorized", () => {
  assert.equal(
    isAuthorizedToProvision({
      jwtRole: "authenticated",
      profile: null,
      fixtureHostSchoolId: "s1",
    }),
    false,
  );
});
