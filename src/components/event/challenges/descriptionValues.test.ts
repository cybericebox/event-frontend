import {describe, expect, it} from "vitest";
import type {LabRuntime} from "@/api/manageLabs";
import type {SnapshotPlaceholder} from "@/api/participantChallenges";
import {runningLab, completedLab, runtimeFixture} from "@/test/labLifecycle";
import {descriptionValues} from "./descriptionValues";

const lab: LabRuntime = {Lab: null, Phase: "Ready", Ready: true, Queue: null, VPNCIDR: "10.128.1.0/24", InternetCIDR: "10.9.4.0/24", Access: []};
const ip = (extra: Partial<SnapshotPlaceholder>): SnapshotPlaceholder => ({key: "ph_a", kind: "ip", ip_reference: "vpn", last_octet: 5, ...extra});

describe("descriptionValues", () => {
    it("resolves subnets and plain IPs as text", () => {
        const {variables, links} = descriptionValues([
            {key: "s", kind: "vpn.subnet", show_mask: true}, {key: "i", kind: "internet.subnet"},
            ip({key: "a"}), ip({key: "b", ip_reference: "internet", last_octet: 12, show_mask: true}),
            ip({key: "c", ip_reference: "static", octets_1to3: "10.0.0", last_octet: 7}),
        ], lab);
        expect(variables).toEqual({s: "10.128.1.0/24", i: "10.9.4.0/24", a: "10.128.1.5", b: "10.9.4.12/24", c: "10.0.0.7"});
        expect(links).toEqual({});
    });

    it("writes a subnet as a CIDR whatever show_mask says", () => {
        const {variables} = descriptionValues([
            {key: "a", kind: "vpn.subnet"}, {key: "b", kind: "vpn.subnet", show_mask: false},
            {key: "c", kind: "internet.subnet", show_mask: false}, {key: "d", kind: "internet.subnet"},
        ], lab);
        expect(variables).toEqual({a: "10.128.1.0/24", b: "10.128.1.0/24", c: "10.9.4.0/24", d: "10.9.4.0/24"});
    });

    it("builds scheme://ip[:port][path] for a link-form IP and returns it as a link", () => {
        const {variables, links} = descriptionValues([
            ip({key: "l1", as_link: true, scheme: "http"}),
            ip({key: "l2", ip_reference: "internet", last_octet: 12, as_link: true, scheme: "https", port: 8443, path: "/admin"}),
            ip({key: "l3", as_link: true, scheme: "http", show_mask: true}),
        ], lab);
        expect(links).toEqual({l1: "http://10.128.1.5", l2: "https://10.9.4.12:8443/admin", l3: "http://10.128.1.5"});
        expect(variables.l2).toBe("https://10.9.4.12:8443/admin");
    });

    it("resolves an external link from the lab's access entry of the named device", () => {
        const {variables, links} = descriptionValues([{key: "w", kind: "external.link", device_name: "web"}, {key: "x", kind: "external.link", device_name: "db"}],
            {...lab, Access: [{Device: "web", Port: 80, Protocol: "http", URL: "https://web.example.com"}]});
        expect(variables).toEqual({w: "https://web.example.com", x: "—"});
        expect(links).toEqual({w: "https://web.example.com"});
    });

    it("shows a dash until the lab supplies the address, and never a link", () => {
        for (const state of [undefined, {...lab, VPNCIDR: ""}]) {
            const {variables, links} = descriptionValues([ip({as_link: true, scheme: "http"}), {key: "ph_x", kind: "external.link", device_name: "web"}], state);
            expect(variables).toEqual({ph_a: "—", ph_x: "—"});
            expect(links).toEqual({});
        }
    });
});

const runtimePlaceholders: SnapshotPlaceholder[] = [
    {key: "web", kind: "external.link", device_name: "web"},
    {key: "ip", kind: "ip", ip_reference: "vpn", last_octet: 5, as_link: true, scheme: "http"},
    {key: "subnet", kind: "vpn.subnet"},
];
it.each([completedLab, {...runningLab, Revision: "9007199254740995"}, {...runningLab, ID: "00000000-0000-4000-8000-000000000101"}, {...runningLab, RuntimeState: "preparing" as const}])("withdraws runtime values for closed, stale, other-identity or unready access %j", lifecycle => {
    const stale = {...runtimeFixture, Access: [{Device: "web", Port: 80, Protocol: "http", URL: "https://web.test"}]};
    expect(descriptionValues(runtimePlaceholders, stale, lifecycle)).toEqual({variables: {web: "—", ip: "—", subnet: "—"}, links: {}});
});
it("retains organizer static IP content after closure", () => {
    expect(descriptionValues([ip({ip_reference: "static", octets_1to3: "192.0.2", as_link: true})], runtimeFixture, completedLab).links).toEqual({ph_a: "http://192.0.2.5"});
});
