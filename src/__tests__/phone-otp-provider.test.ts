import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { phoneOtp } from "@/convex/auth/phoneOtp";

/**
 * Backend contract for real SMS sign-in.
 *
 * These tests exist to prevent a regression into a "fake" phone login: the
 * provider must call a real SMS API with server-side credentials, must never
 * hardcode a token, and must never hand the token back to the client.
 */

const ENV = {
  TWILIO_ACCOUNT_SID: "ACtest",
  TWILIO_AUTH_TOKEN: "testtoken",
  TWILIO_PHONE_NUMBER: "+14155238886",
};

type SendArgs = {
  identifier: string;
  token: string;
  provider: unknown;
  url: string;
  expires: Date;
};

/**
 * Convex Auth resolves a provider's effective config by merging the provider
 * object with its `options` (see providerDefaults in @convex-dev/auth), which is
 * how the `id` passed into Phone() overrides the hardcoded "phone" default.
 * Mirror that merge so these assertions describe the real runtime shape.
 */
const resolved = phoneOtp as unknown as {
  id: string;
  type: string;
  options: {
    id: string;
    maxAge: number;
    normalizeIdentifier: (value: string) => string;
    generateVerificationToken: () => Promise<string>;
  };
  sendVerificationRequest: (
    args: SendArgs,
    ctx: never,
  ) => Promise<void>;
};

const effective = { ...resolved, ...resolved.options };

function send(args: Partial<SendArgs> = {}) {
  return resolved.sendVerificationRequest(
    {
      identifier: "+919876543210",
      token: "123456",
      provider: phoneOtp,
      url: "http://localhost",
      expires: new Date(Date.now() + 60_000),
      ...args,
    } as SendArgs,
    // Convex Auth passes a mutation context here; it has no runAction, which is
    // exactly why the provider must not depend on one.
    {} as never,
  );
}

describe("phoneOtp provider registration", () => {
  it("is a registered phone provider with a stable id", () => {
    expect(effective.type).toBe("phone");
    expect(effective.id).toBe("phone-otp");
  });

  it("normalises Indian numbers to E.164", () => {
    expect(effective.normalizeIdentifier("9876543210")).toBe("+919876543210");
    expect(effective.normalizeIdentifier("+919876543210")).toBe("+919876543210");
  });

  it("generates a fresh random 6-digit token on every call", async () => {
    const tokens = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const token = await effective.generateVerificationToken();
      expect(token).toMatch(/^\d{6}$/);
      tokens.add(token);
    }
    // Not a constant — each send gets a distinct code.
    expect(tokens.size).toBeGreaterThan(1);
  });
});

describe("phoneOtp sendVerificationRequest", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  const savedEnv = { ...process.env };

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      text: async () => '{"sid":"SM123"}',
    });
    vi.stubGlobal("fetch", fetchMock);
    Object.assign(process.env, ENV);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...savedEnv };
  });

  it("sends a real SMS through the Twilio REST API", async () => {
    await send();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("api.twilio.com");
    expect(url).toContain(ENV.TWILIO_ACCOUNT_SID);
    expect(init.method).toBe("POST");

    const body = init.body as URLSearchParams;
    expect(body.get("To")).toBe("+919876543210");
    expect(body.get("From")).toBe(ENV.TWILIO_PHONE_NUMBER);
    expect(body.get("Body")).toContain("123456");
  });

  it("keeps the SMS secret server-side in an Authorization header", async () => {
    await send();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    // Credentials travel only in the server-side request, never to the client.
    expect(headers.Authorization).toBe(
      `Basic ${btoa(`${ENV.TWILIO_ACCOUNT_SID}:${ENV.TWILIO_AUTH_TOKEN}`)}`,
    );
  });

  it("fails loudly when Twilio is not configured, without sending anything", async () => {
    delete process.env.TWILIO_ACCOUNT_SID;
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(send()).rejects.toThrow("SMS_PROVIDER_NOT_CONFIGURED");
    // Crucially, no SMS is sent and no code is invented.
    expect(fetchMock).not.toHaveBeenCalled();

    error.mockRestore();
  });

  it("rejects an unusable phone number before calling the provider", async () => {
    await expect(send({ identifier: "not-a-number" })).rejects.toThrow(
      "SMS_INVALID_PHONE",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("surfaces a Twilio rejection as a generic send failure", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => '{"code":20003,"message":"Authenticate"}',
    });
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(send()).rejects.toThrow("SMS_SEND_FAILED");

    error.mockRestore();
  });

  it("surfaces a network failure as a generic send failure", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));
    await expect(send()).rejects.toThrow("SMS_SEND_FAILED");
  });

  it("never returns the token to the caller", async () => {
    const result = await send();
    // sendVerificationRequest resolves with nothing; the code stays server-side.
    expect(result).toBeUndefined();
  });
});
