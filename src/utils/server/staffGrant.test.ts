import {generateKeyPairSync, sign} from "node:crypto";
import {describe, expect, it, vi} from "vitest";

const pair = generateKeyPairSync("ed25519");
const keys = vi.hoisted(() => ({get: vi.fn()}));
vi.mock("@/api/renderKey", () => ({getRenderKey: keys.get}));
import {hasStaffGrant} from "./staffGrant";

const now = Math.floor(Date.now() / 1000);
function token(change = {}) {
    const claims = {iss: "cybericebox:event-render", aud: "https://one.example.test", scope: "common-pages", sub: "11111111-1111-4111-8111-111111111111", sid: "22222222-2222-4222-8222-222222222222", event_id: "33333333-3333-4333-8333-333333333333", preview: true, challenge: "a".repeat(43), iat: now - 1, exp: now + 299, ...change};
    const raw = [Buffer.from(JSON.stringify({alg: "EdDSA", typ: "cib-event-render+jwt", kid: "key1"})).toString("base64url"), Buffer.from(JSON.stringify(claims)).toString("base64url")].join(".");
    return raw + "." + sign(null, Buffer.from(raw), pair.privateKey).toString("base64url");
}
keys.get.mockResolvedValue({KeyID: "key1", PublicKey: pair.publicKey.export({format: "jwk"}).x!});

describe("hasStaffGrant", () => {
    it("accepts a signed, unexpired preview grant for this host", async () => {
        expect(await hasStaffGrant("one.example.test", token())).toBe(true);
    });
    it.each([
        ["no cookie", undefined, "one.example.test"],
        ["another host", token(), "two.example.test"],
        ["an expired grant", token({iat: now - 400, exp: now - 100}), "one.example.test"],
        ["a non-preview grant", token({preview: false}), "one.example.test"],
        ["garbage", "not-a-token", "one.example.test"],
        ["a platform host", token(), "example.test"],
    ])("rejects %s", async (_name, value, host) => {
        expect(await hasStaffGrant(host, value)).toBe(false);
    });
    it("stays anonymous when the key cannot be read", async () => {
        keys.get.mockRejectedValueOnce(new Error("down"));
        expect(await hasStaffGrant("one.example.test", token())).toBe(false);
    });
});
