import type {ManageStage} from "@/api/manageStages";

// «2026-10-01T10:00» for a datetime input from an ISO instant, in the browser's zone.
export function localDateTime(iso: string | null): string {
    if (!iso) return "";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export type StageDraft = {Name: string; OpensAt: string; ClosesAt: string};

export const draftOfStage = (stage: ManageStage): StageDraft => ({Name: stage.Name, OpensAt: localDateTime(stage.OpensAt), ClosesAt: localDateTime(stage.ClosesAt)});

export const stageDirty = (stage: ManageStage, draft: StageDraft): boolean => JSON.stringify(draftOfStage(stage)) !== JSON.stringify(draft);

// What a stage allows by its state (the server enforces the same): upcoming everything; open its name, the
// returnable switch and the closing time; closed only the name. The first stage's opening and the last stage's
// closing are the event's own.
export type StageLocks = {name: boolean; opens: boolean; closes: boolean; returnable: boolean; canClose: boolean; canDelete: boolean};

export function stageLocks(stage: Pick<ManageStage, "State" | "First" | "Last">): StageLocks {
    const closed = stage.State === "closed";
    const opened = stage.State !== "upcoming";
    return {
        name: false,
        opens: opened || stage.First,
        closes: closed || stage.Last,
        returnable: closed,
        canClose: stage.State === "open",
        canDelete: stage.State === "upcoming",
    };
}

// The breaks shorter than the lead the platform computes for the stage after them: that stage's labs then deploy while
// the previous one is still running.
export function shortBreaks(stages: ManageStage[]): {name: string; minutes: number}[] {
    const out: {name: string; minutes: number}[] = [];
    for (let index = 1; index < stages.length; index++) {
        const lead = stages[index].DeployLeadMinutes;
        const gap = Date.parse(stages[index].OpensAt) - Date.parse(stages[index - 1].ClosesAt);
        if (lead > 0 && Number.isFinite(gap) && gap < lead * 60_000) out.push({name: stages[index].Name, minutes: lead});
    }
    return out;
}

// An instant in the future from a datetime input value, or null when it is empty or not a date.
export function isoOf(local: string): string | null {
    if (!local) return null;
    const time = new Date(local).getTime();
    return Number.isNaN(time) ? null : new Date(time).toISOString();
}
