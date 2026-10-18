import {generateKeyPairSync, sign} from "node:crypto";
import {describe, expect, it} from "vitest";
import {verifyRenderGrant, eventOriginFromHost, validSessionRequest} from "./eventRenderGrant";
const pair = generateKeyPairSync("ed25519");
const key = {KeyID: "key1", PublicKey: pair.publicKey.export({format: "jwk"}).x!};
const claims = {iss: "cybericebox:event-render", aud: "https://one.example.test", scope: "common-pages", sub: "11111111-1111-4111-8111-111111111111", sid: "22222222-2222-4222-8222-222222222222", event_id: "33333333-3333-4333-8333-333333333333", preview: true, challenge: "a".repeat(43), iat: 100, exp: 160};
function token(change = {}, header = {}) {
    const raw = [Buffer.from(JSON.stringify({alg: "EdDSA", typ: "cib-event-render+jwt", kid: "key1", ...header})).toString("base64url"), Buffer.from(JSON.stringify({...claims, ...change})).toString("base64url")].join(".");
    return raw + "." + sign(null, Buffer.from(raw), pair.privateKey).toString("base64url");
}
describe("event read grants", () => {
    it("accepts the correct purpose/audience with a bounded lifetime", () => {
        expect(verifyRenderGrant(token(), key, claims.aud, 120)?.event_id).toBe(claims.event_id);
    });
    it("accepts a five-minute grant and no longer one", () => {
        expect(verifyRenderGrant(token({exp: 400}), key, claims.aud, 120)).not.toBeNull();
        expect(verifyRenderGrant(token({exp: 401}), key, claims.aud, 120)).toBeNull();
    });
    it.each([{exp: 120}, {exp: 401}, {iat: 121}, {aud: "https://two.example.test"}, {scope: "admin"}, {event_id: "bad"}, {preview: "true"}, {challenge: "bad"}])("rejects invalid claims %j", change => {
        expect(verifyRenderGrant(token(change), key, claims.aud, 120)).toBeNull();
    });
    it("rejects tampering, other algorithms and oversize tokens", () => {
        expect(verifyRenderGrant(token() + "x", key, claims.aud, 120)).toBeNull();
        expect(verifyRenderGrant(token({}, {alg: "HS256"}), key, claims.aud, 120)).toBeNull();
        expect(verifyRenderGrant("a".repeat(8193), key, claims.aud, 120)).toBeNull();
    });
    it("allows only canonical event hosts and exact-origin JSON session requests", () => {
        expect(eventOriginFromHost("one.example.test")).toBe(claims.aud);
        for (const host of ["example.test", "api.example.test", "one.example.test.evil", "one.example.test:443", "a.b.example.test"]) expect(eventOriginFromHost(host)).toBeNull();
        const req = (origin: string) => new Request(claims.aud + "/api/event-session", {method: "POST", headers: {Host: "one.example.test", Origin: origin, "Content-Type": "application/json", "x-cib-event-session": "1"}});
        expect(validSessionRequest(req(claims.aud))).toBe(true);
        expect(validSessionRequest(req("https://evil.example.test"))).toBe(false);
    });
});
