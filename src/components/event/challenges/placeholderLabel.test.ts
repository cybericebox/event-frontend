import {describe, expect, it} from "vitest";
import {placeholderLabel} from "./placeholderLabel";

describe("placeholderLabel", () => {
    it("names the gateway of a subnet and of an address", () => {
        expect(placeholderLabel({key: "a", kind: "gateway.subnet", gateway: "attack"})).toBe("підмережа шлюзу attack");
        expect(placeholderLabel({key: "b", kind: "ip", ip_reference: "gateway", gateway: "attack", last_octet: 5})).toBe("адреса у шлюзі attack, .5");
    });
});
