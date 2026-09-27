import type {ContentValue} from "@/types/eventContent";

export function nextContentRefreshAt(values: Record<string, ContentValue>, now: number): number | null {
    const upcoming = [values["event.startAt"], values["event.effectiveFinishAt"]]
        .filter((value): value is string => typeof value === "string")
        .map(value => Date.parse(value))
        .filter(value => Number.isFinite(value) && value > now);
    return upcoming.length ? Math.min(...upcoming) : null;
}

export function applyLifecycleBoundaries(values: Record<string, ContentValue>, now: number): Record<string, ContentValue> {
    const start = typeof values["event.startAt"] === "string" ? Date.parse(values["event.startAt"]) : NaN;
    const finish = typeof values["event.effectiveFinishAt"] === "string" ? Date.parse(values["event.effectiveFinishAt"]) : NaN;
    const current = {...values};
    if (current["event.phase"] === "withdrawn") return current;
    if (Number.isFinite(finish) && now >= finish) {
        if ("event.isStarted" in current) current["event.isStarted"] = false;
        if ("event.isFinished" in current) current["event.isFinished"] = true;
        if (current["event.phase"] === "started" || current["event.phase"] === "published") current["event.phase"] = "finished";
        if ("event.registrationOpen" in current) current["event.registrationOpen"] = false;
    } else if (Number.isFinite(start) && now >= start) {
        if (current["event.phase"] !== "finished" && current["event.isFinished"] !== true) {
            if (current["event.phase"] === "published") current["event.phase"] = "started";
            if ("event.isStarted" in current) current["event.isStarted"] = true;
        }
        if (current["event.joinPolicy"] === "locked_at_start" && "event.registrationOpen" in current) current["event.registrationOpen"] = false;
    }
    return current;
}
