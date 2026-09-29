import {describe, expect, it} from "vitest";
import {mailTabs} from "./mailTabs";

describe("settings page tabs", () => {
    it("has the mail tab", () => {
        expect(mailTabs.map(tab => [tab.value, tab.label])).toEqual([["mail", "Пошта"]]);
    });
});
