import {expect, it} from "vitest";
import {navigationRight} from "./navigationRight";

const base = {authenticated: true, approved: true, pinned: true};

it("orders VPN, participation, inbox, account for a participant", () => {
    expect(navigationRight(base)).toEqual(["vpn", "participation", "inbox", "account"]);
});
it("shows the organizer preview without VPN but with the participation item", () => {
    expect(navigationRight({...base, approved: false})).toEqual(["participation", "inbox", "account"]);
});
it("keeps only inbox and account where the items are not pinned (manage topbar)", () => {
    expect(navigationRight({...base, approved: false, pinned: false})).toEqual(["inbox", "account"]);
});
it("shows nothing to a guest", () => {
    expect(navigationRight({...base, authenticated: false, approved: false, pinned: false})).toEqual([]);
});
