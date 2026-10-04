import {MAX_FLAG_ATTEMPTS} from "@/api/attemptLimit";

export type AttemptLimitDraft = {valid: boolean; value: number | null};

// An empty field is "no value" (unlimited on an event, the event's value on a task); otherwise a whole number from 1 to 1000.
export function parseAttemptLimit(raw: string): AttemptLimitDraft {
    const text = raw.trim();
    if (text === "") return {valid: true, value: null};
    const value = Number(text);
    return Number.isInteger(value) && value >= 1 && value <= MAX_FLAG_ATTEMPTS ? {valid: true, value} : {valid: false, value: null};
}

