import {expect, it} from "vitest";
import {navigationRight} from "./navigationRight";

const base = {authenticated: true, approved: true, pinned: true, teamMode: true};

it("orders VPN, team, profile, inbox, account for a team participant", () => {
    expect(navigationRight(base)).toEqual(["vpn", "team", "profile", "inbox", "account"]);
});
it("drops the team entry in individual mode", () => {
    expect(navigationRight({...base, teamMode: false})).toEqual(["vpn", "profile", "inbox", "account"]);
});
it("shows the organizer preview without VPN but with the participant items", () => {
    expect(navigationRight({...base, approved: false})).toEqual(["team", "profile", "inbox", "account"]);
});
it("keeps only inbox and account where the items are not pinned (manage topbar)", () => {
    expect(navigationRight({...base, approved: false, pinned: false})).toEqual(["inbox", "account"]);
});
it("shows nothing to a guest", () => {
    expect(navigationRight({...base, authenticated: false})).toEqual([]);
});
