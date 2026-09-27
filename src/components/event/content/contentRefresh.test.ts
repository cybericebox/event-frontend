import {expect, it} from "vitest";
import {applyLifecycleBoundaries, nextContentRefreshAt} from "./contentRefresh";

it("refreshes at the next lifecycle boundary", () => {
    const start = "2026-09-28T10:00:00Z";
    const finish = "2026-09-28T12:00:00Z";
    const values = {"event.startAt": start, "event.effectiveFinishAt": finish};
    expect(nextContentRefreshAt(values, Date.parse(start) - 1)).toBe(Date.parse(start));
    expect(nextContentRefreshAt(values, Date.parse(start))).toBe(Date.parse(finish));
    expect(nextContentRefreshAt(values, Date.parse(finish))).toBeNull();
});

it("updates public lifecycle conditions at the boundary even while cached values are stale", () => {
    const start = Date.parse("2026-09-28T10:00:00Z");
    const finish = Date.parse("2026-09-28T12:00:00Z");
    const values = {"event.startAt": new Date(start).toISOString(), "event.effectiveFinishAt": new Date(finish).toISOString(), "event.joinPolicy": "locked_at_start", "event.phase": "published", "event.isStarted": false, "event.isFinished": false, "event.registrationOpen": true};
    expect(applyLifecycleBoundaries(values, start - 1)["event.registrationOpen"]).toBe(true);
    expect(applyLifecycleBoundaries(values, start)).toMatchObject({"event.phase": "started", "event.isStarted": true, "event.registrationOpen": false});
    expect(applyLifecycleBoundaries(values, finish)).toMatchObject({"event.phase": "finished", "event.isFinished": true, "event.registrationOpen": false});
});
