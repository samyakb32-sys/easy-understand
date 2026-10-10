import { describe, expect, it } from "vitest";
import { fetchMe } from "../components/useEntitlements";

const resp = (body: string, status = 200) => (async () => new Response(body, { status })) as unknown as typeof fetch;

describe("fetchMe", () => {
  it("returns the parsed answer", async () => {
    const me = await fetchMe(resp(JSON.stringify({ signedIn: false, isPro: false, configured: { auth: true, payments: true } })));
    expect(me?.configured.auth).toBe(true);
  });
  it("returns null for a 500 HTML page instead of throwing", async () => {
    expect(await fetchMe(resp("<html>Internal Server Error</html>", 500))).toBeNull();
  });
  it("returns null for a 200 that is not JSON, and for a network error", async () => {
    expect(await fetchMe(resp("<html></html>"))).toBeNull();
    expect(await fetchMe((async () => { throw new TypeError("offline"); }) as unknown as typeof fetch)).toBeNull();
  });
});
