import type {BulkExerciseResult} from "@/api/manageChallenges";
import {apiErrorMessage} from "@/api/apiErrors";

// Requests go in small chunks so the busy label can count the progress («Публікуємо… 3/10»).
export const BULK_CHUNK = 5;

export type BulkSkip = {id: string; reason: string};
export type BulkOutcome = {changed: string[]; skipped: BulkSkip[]};

// Runs one bulk action over the selection chunk by chunk. A chunk that fails as a whole (network, rights) skips its
// sets with that reason and the next chunks still run; onChunk sees the sets each chunk changed.
export async function runBulk(ids: string[], call: (chunk: string[]) => Promise<BulkExerciseResult>, {onProgress, onChunk, failed}: {
    onProgress?: (done: number, total: number) => void; onChunk?: (changed: string[]) => void; failed: (error: unknown) => string;
}): Promise<BulkOutcome> {
    const outcome: BulkOutcome = {changed: [], skipped: []};
    onProgress?.(0, ids.length);
    for (let start = 0; start < ids.length; start += BULK_CHUNK) {
        const chunk = ids.slice(start, start + BULK_CHUNK);
        try {
            const result = await call(chunk);
            const changed = result.Results.filter(item => item.Changed).map(item => item.ID);
            outcome.changed.push(...changed);
            outcome.skipped.push(...result.Results.filter(item => !item.Changed).map(item => ({id: item.ID, reason: apiErrorMessage(item.Code, item.Message || "")})));
            if (changed.length > 0) onChunk?.(changed);
        } catch (error) {
            const reason = failed(error);
            outcome.skipped.push(...chunk.map(id => ({id, reason})));
        }
        onProgress?.(Math.min(start + chunk.length, ids.length), ids.length);
    }
    return outcome;
}
