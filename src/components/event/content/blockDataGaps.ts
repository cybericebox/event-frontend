import type {ContentBlock} from "@/types/eventContent";

type Value = string | number | boolean | null;

export type BlockDataGap = {field: "targetVariable" | "targetDate"; variable?: string};

export function countdownTarget(block: ContentBlock, variables: Record<string, Value>): string | null {
    const target = block.targetDate || variables[block.targetVariable ?? ""];
    return typeof target === "string" && Number.isFinite(Date.parse(target)) ? target : null;
}

// Tells whether the site will hide the block (or part of it) because data it
// depends on is not configured. Only the countdown and the hero timer today.
export function blockDataGap(block: ContentBlock, variables: Record<string, Value>): BlockDataGap | null {
    if (block.type === "countdown" || (block.type === "hero" && (block.targetVariable || block.targetDate))) {
        if (countdownTarget(block, variables)) return null;
        return block.targetDate || !block.targetVariable ? {field: "targetDate"} : {field: "targetVariable", variable: block.targetVariable};
    }
    return null;
}
