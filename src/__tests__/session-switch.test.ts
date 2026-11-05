import { beforeEach, describe, expect, it } from "vitest";
import {
  consumeAccountSwitch,
  decidePostSignInDestination,
  isAccountSwitchPending,
  isCustomerPrivateRoute,
  markAccountSwitchPending,
} from "@/lib/session";

const diminishing = () => {
  window.localStorage.clear();
  window.sessionStorage.clear();
};

describe("account switch session state", () => {
  beforeEach(diminishing);

  it("marks a logout for the next sign-in and clears navigation state", () => {
    window.localStorage.setItem("kc_return_to", "/account/notifications");
    window.sessionStorage.setItem("kc_selected_notification", "n1");

    markAccountSwitchPending();

    expect(isAccountSwitchPending()).toBe(true);
    expect(window.localStorage.getItem("kc_return_to")).toBeNull();
    expect(window.sessionStorage.getItem("kc_selected_notification")).toBeNull();
  });

  it("forces the homepage for the first sign-in after a logout", () => {
    markAccountSwitchPending();
    const state = consumeAccountSwitch("user-b");

    expect(state.pending).toBe(true);
    const destination = decidePostSignInDestination({
      state,
      role: "customer",
      redirect: "/account/notifications",
    });
    expect(destination).toEqual({ path: "/", forceHome: true });
    expect(isAccountSwitchPending()).toBe(false);
  });

  it("detects a different account even without an explicit logout", () => {
    consumeAccountSwitch("user-a");
    const state = consumeAccountSwitch("user-b");

    expect(state.differentUser).toBe(true);
    const destination = decidePostSignInDestination({
      state,
      role: "customer",
      redirect: "/account/notifications?notification=n1",
    });
    expect(destination).toEqual({ path: "/", forceHome: true });
  });

  it("keeps a genuine guest deep link for a first-time sign-in", () => {
    const state = consumeAccountSwitch("user-a");
    const destination = decidePostSignInDestination({
      state,
      role: "customer",
      redirect: "/cart",
    });
    expect(destination).toEqual({ path: "/cart", forceHome: false });
  });

  it("keeps a deep link for the same account signing in again", () => {
    consumeAccountSwitch("user-a");
    const state = consumeAccountSwitch("user-a");
    const destination = decidePostSignInDestination({
      state,
      role: "customer",
      redirect: "/account/profile",
    });
    expect(destination).toEqual({ path: "/account/profile", forceHome: false });
  });

  it("never pulls an admin onto the customer homepage", () => {
    markAccountSwitchPending();
    const state = consumeAccountSwitch("admin-a");
    const destination = decidePostSignInDestination({
      state,
      role: "admin",
      redirect: "/admin",
    });
    expect(destination).toEqual({ path: "/admin", forceHome: false });
  });

  it("recognises private customer routes only", () => {
    expect(isCustomerPrivateRoute("/account/notifications")).toBe(true);
    expect(isCustomerPrivateRoute("/dashboard")).toBe(true);
    expect(isCustomerPrivateRoute("/orders/123")).toBe(true);
    expect(isCustomerPrivateRoute("/cart")).toBe(false);
    expect(isCustomerPrivateRoute("/products/volini-gel")).toBe(false);
    expect(isCustomerPrivateRoute("/")).toBe(false);
  });
});
