import {describe, expect, it, vi} from "vitest";
import {runBulk} from "./bulkModel";

const ids = Array.from({length: 12}, (_, i) => `id-${i}`);

describe("runBulk", () => {
    it("sends the selection in chunks, reports progress and keeps going after a failed chunk", async () => {
        const calls: string[][] = [];
        const call = vi.fn(async (chunk: string[]) => {
            calls.push(chunk);
            if (chunk.includes("id-5")) throw new Error("offline");
            return {Changed: chunk.length - 1, Skipped: 1, Results: chunk.map((id, i) => i === 0 ? {ID: id, Changed: false, Message: "Етап уже відкрито"} : {ID: id, Changed: true})};
        });
        const progress: string[] = [];
        const changedByChunk: string[][] = [];
        const outcome = await runBulk(ids, call, {onProgress: (done, total) => progress.push(`${done}/${total}`), onChunk: changed => changedByChunk.push(changed), failed: () => "Немає звʼязку"});
        expect(calls.map(chunk => chunk.length)).toEqual([5, 5, 2]);
        expect(progress).toEqual(["0/12", "5/12", "10/12", "12/12"]);
        expect(outcome.changed).toEqual(["id-1", "id-2", "id-3", "id-4", "id-11"]);
        expect(outcome.skipped.map(skip => skip.id)).toEqual(["id-0", "id-5", "id-6", "id-7", "id-8", "id-9", "id-10"]);
        expect(outcome.skipped[0].reason).toBe("Етап уже відкрито");
        expect(outcome.skipped[1].reason).toBe("Немає звʼязку");
        expect(changedByChunk).toHaveLength(2);
    });
});
