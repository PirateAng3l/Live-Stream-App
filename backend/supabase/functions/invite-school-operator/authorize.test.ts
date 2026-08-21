import { strict as assert } from "node:assert";
import { isAuthorizedToInvite } from "./authorize.ts";

Deno.test("a platform_admin is authorized", () => {
  assert.equal(isAuthorizedToInvite({ role: "platform_admin" }), true);
});

Deno.test("a school_operator is not authorized", () => {
  assert.equal(isAuthorizedToInvite({ role: "school_operator" }), false);
});

Deno.test("a parent is not authorized", () => {
  assert.equal(isAuthorizedToInvite({ role: "parent" }), false);
});

Deno.test("no profile at all (e.g. lookup failed) is not authorized", () => {
  assert.equal(isAuthorizedToInvite(null), false);
});
