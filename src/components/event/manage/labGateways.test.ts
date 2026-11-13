import {describe, expect, it} from "vitest";
import type {LabGateway} from "@/api/manageLabs";
import {noWebText} from "./labGateways";

const gateway = (Name: string, Kind: "vpn" | "internet", CIDR: string): LabGateway => ({Name, Kind, CIDR, Ready: true});

describe("noWebText", () => {
    it("names no subnet when the lab has no VPN gateway", () => {
        expect(noWebText([])).toBe("Вебадрес немає.");
        expect(noWebText([gateway("out", "internet", "10.128.2.0/24")])).toBe("Вебадрес немає.");
    });
    it("names each VPN gateway with its subnet, in the form of the count", () => {
        expect(noWebText([gateway("attack", "vpn", "10.128.1.0/24"), gateway("out", "internet", "10.128.2.0/24")])).toBe("Вебадрес немає. Підмережа VPN: attack 10.128.1.0/24");
        expect(noWebText([gateway("attack", "vpn", "10.128.1.0/24"), gateway("backup", "vpn", "")])).toBe("Вебадрес немає. Підмережі VPN: attack 10.128.1.0/24 і backup —");
    });
});
