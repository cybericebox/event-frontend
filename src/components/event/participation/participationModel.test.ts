import {describe, expect, it} from "vitest";
import type {ParticipantForm} from "@/api/manageParticipantForm";
import {changedEditableAnswers, editableForm, formatAnswer, formFields, defaultParticipationTab, joinCodeFromSearch, joinLink, participationTabFromParam, teamRedirectHref, joinLinkValidity, parseJoinCode, rosterLine} from "./participationModel";

const form: ParticipantForm = {Version: 1, Enabled: true, Required: true, Document: {blocks: [
    {id: "a", type: "field", key: "city", input: "text", label: "Місто", editable: true},
    {id: "b", type: "field", key: "school", input: "text", label: "Заклад"},
    {id: "c", type: "field", key: "langs", input: "multi_select", label: "Мови", options: ["Go", "TS"], editable: true},
]}};

describe("participation model", () => {
    it("formats stored answers for reading", () => {
        expect(formatAnswer(undefined)).toBe("—");
        expect(formatAnswer(["Go", "TS"])).toBe("Go, TS");
        expect(formatAnswer(true)).toBe("Так");
        expect(formatAnswer(3)).toBe("3");
    });

    it("keeps only editable fields in the edit form", () => {
        expect(formFields(editableForm(form)).map(field => field.key)).toEqual(["city", "langs"]);
        expect(editableForm(form).Required).toBe(false);
        expect(formFields({...form, Enabled: false})).toEqual([]);
    });

    it("sends only changed editable answers", () => {
        const before = {city: "Київ", school: "КПІ", langs: ["Go"]};
        expect(changedEditableAnswers(form, before, {...before, city: "Львів", school: "ЛНУ"})).toEqual({city: "Львів"});
        expect(changedEditableAnswers(form, before, {...before, langs: ["Go"]})).toEqual({});
        expect(changedEditableAnswers(form, before, {...before, langs: ["Go", "TS"]})).toEqual({langs: ["Go", "TS"]});
    });

    it("describes the roster size", () => {
        expect(rosterLine(3, 5, 2)).toBe("3 з 5 · мінімум 2");
        expect(rosterLine(1, null, 1)).toBe("1");
    });
});

describe("join link", () => {
    it("builds the link from the event origin and the code", () => {
        expect(joinLink("https://olymp.example.com", "a b/c")).toBe("https://olymp.example.com/team?join=a%20b%2Fc");
    });

    it("reads the code from a pasted link or a bare code", () => {
        expect(parseJoinCode("https://olymp.example.com/team?join=abc-123")).toBe("abc-123");
        expect(parseJoinCode("  abc-123  ")).toBe("abc-123");
        expect(parseJoinCode("olymp.example.com/team?join=abc-123&x=1")).toBe("abc-123");
        expect(parseJoinCode("")).toBe("");
        expect(joinCodeFromSearch("?join=abc-123")).toBe("abc-123");
        expect(joinCodeFromSearch("")).toBe("");
    });

    it("tells how long the link stays valid", () => {
        const now = Date.parse("2026-07-01T09:00:00Z");
        expect(joinLinkValidity(null, now)).toEqual({text: "Без обмеження строку", expired: false});
        expect(joinLinkValidity("2026-07-02T09:00:00Z", now).expired).toBe(false);
        expect(joinLinkValidity("2026-07-02T09:00:00Z", now).text).toMatch(/^Діє до /);
        expect(joinLinkValidity("2026-06-30T09:00:00Z", now)).toMatchObject({expired: true});
    });
});


it("sends /team to the team tab and keeps the join code", () => {
    expect(teamRedirectHref("")).toBe("/participation?tab=team");
    expect(teamRedirectHref("?join=abc")).toBe("/participation?join=abc&tab=team");
});

it("knows the tab only when it exists in this mode", () => {
    expect(participationTabFromParam("team", true)).toBe("team");
    expect(participationTabFromParam("team", false)).toBeNull();
    expect(participationTabFromParam("profile", false)).toBe("profile");
    expect(participationTabFromParam("x", true)).toBeNull();
});

it("defaults to the team only for a captain with an incomplete team", () => {
    const base = {teamMode: true, captain: true, memberCount: 3, minSize: 2, pending: 0};
    expect(defaultParticipationTab(base)).toBe("profile");
    expect(defaultParticipationTab({...base, memberCount: 1})).toBe("team");
    expect(defaultParticipationTab({...base, pending: 1})).toBe("team");
    expect(defaultParticipationTab({...base, captain: false, memberCount: 1})).toBe("profile");
    expect(defaultParticipationTab({...base, teamMode: false, memberCount: 1})).toBe("profile");
});
