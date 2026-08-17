import { describe, expect, it } from "vitest";
import { isSubscriptionOperational, subscriptionStatusLabel } from "./subscriptions";

describe("isSubscriptionOperational", () => {
  it("treats trial and active as operational", () => {
    expect(isSubscriptionOperational("trial")).toBe(true);
    expect(isSubscriptionOperational("active")).toBe(true);
  });

  it("treats expired and cancelled as not operational", () => {
    expect(isSubscriptionOperational("expired")).toBe(false);
    expect(isSubscriptionOperational("cancelled")).toBe(false);
  });
});

describe("subscriptionStatusLabel", () => {
  it("labels every status", () => {
    expect(subscriptionStatusLabel("trial")).toBe("Trial");
    expect(subscriptionStatusLabel("active")).toBe("Active");
    expect(subscriptionStatusLabel("expired")).toBe("Expired");
    expect(subscriptionStatusLabel("cancelled")).toBe("Cancelled");
  });
});
