import {describe, expect, it} from "vitest";
import type {EventBoardChallenge, EventChallengeGroup, EventExerciseAttachment} from "@/api/manageChallenges";
import {descriptionFirstLine, groupBuckets, orderedGroups} from "./challengeOrder";

const attachment = (id: string, createdAt: string) => ({ID: id, CreatedAt: createdAt}) as EventExerciseAttachment;
const challenge = (id: string, patch: Partial<EventBoardChallenge> = {}) => ({ID: id, GroupID: null, Order: 0, BoardOrder: null, ...patch}) as EventBoardChallenge;
const group = (id: string, order: number, name = id) => ({ID: id, Name: name, Order: order, CreatedAt: ""}) as EventChallengeGroup;

describe("challenge order", () => {
    it("orders groups by their order, then name", () => {
        expect(orderedGroups([group("b", 1), group("z", 0), group("a", 1)]).map(item => item.ID)).toEqual(["z", "a", "b"]);
    });

    it("buckets tasks across sets in board order with «Без групи» last", () => {
        const first = attachment("s1", "2026-01-01T00:00:00Z");
        const second = attachment("s2", "2026-01-02T00:00:00Z");
        const buckets = groupBuckets([group("web", 1), group("crypto", 0)], [
            {attachment: second, challenges: [challenge("c", {GroupID: "web", Order: 0}), challenge("gone", {GroupID: "deleted"})]},
            {attachment: first, challenges: [challenge("b", {GroupID: "web", Order: 1}), challenge("a", {GroupID: "web", Order: 0, BoardOrder: 5}), challenge("x", {GroupID: "crypto"})]},
        ]);
        expect(buckets.map(bucket => [bucket.groupID, bucket.tasks.map(task => task.challenge.ID)])).toEqual([
            ["crypto", ["x"]],
            // Ordered first (a: 5), then unordered by set attach time, then set order.
            ["web", ["a", "b", "c"]],
            [null, ["gone"]],
        ]);
    });

    it("reads the first description line as plain text", () => {
        const doc = {root: {type: "root", children: [
            {type: "paragraph", children: []},
            {type: "paragraph", children: [{type: "text", text: "Знайдіть "}, {type: "text", text: "прапор"}]},
            {type: "paragraph", children: [{type: "text", text: "Друга"}]},
        ]}};
        expect(descriptionFirstLine(doc)).toBe("Знайдіть прапор");
        expect(descriptionFirstLine("  \nold text\nmore")).toBe("old text");
        expect(descriptionFirstLine(undefined)).toBe("");
    });

    it("shows placeholders as readable chips, never raw keys", () => {
        const doc = {root: {type: "root", children: [{type: "paragraph", children: [
            {type: "text", text: "Відкрийте "}, {type: "variable", varName: "web_link"}, {type: "text", text: " і "}, {type: "variable", varName: "lnk"},
        ]}]}};
        const line = descriptionFirstLine(doc, [
            {key: "web_link", kind: "external.link", device_name: "both"},
            {key: "lnk", kind: "ip", ip_reference: "vpn", last_octet: 5, as_link: true, scheme: "http", port: 5000},
        ]);
        expect(line).toBe("Відкрийте [вебпосилання both] і [посилання http://…:5000]");
    });
});
