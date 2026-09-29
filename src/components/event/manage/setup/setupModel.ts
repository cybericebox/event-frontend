import type {ManageConfig, ManageContent, ManageLifecycle} from "@/api/manage";
import type {EventExerciseAttachment} from "@/api/manageChallenges";
import type {EventMailSettings} from "@/api/manageMail";
import {infrastructureMismatch} from "../exercises/attachmentModel";

// done: nothing left to do. todo: a required step that is still open.
// blocked: a required step that cannot finish until something is fixed.
// optional: nothing is required; the default is fine, the page is there to tune it.
export type SetupStatus = "done" | "todo" | "blocked" | "optional";
export type SetupStepID = "participation" | "registration" | "schedule" | "challenges" | "scoring" | "pages" | "mail" | "results" | "stands" | "publish";
export type SetupStep = {id: SetupStepID; status: SetupStatus; href: string; detail: string; vars?: Record<string, string | number>};

// Whatever has loaded so far; a missing part leaves its step out rather than guessing.
export type SetupInput = {
    config: ManageConfig;
    lifecycle: ManageLifecycle;
    attachments?: EventExerciseAttachment[];
    content?: ManageContent;
    mail?: EventMailSettings;
};

// detail is a message key suffix under manage.setup.detail.
export function buildSetupSteps({config, lifecycle, attachments, content, mail}: SetupInput): SetupStep[] {
    const steps: SetupStep[] = [];
    const published = lifecycle.Status !== "not_published";

    steps.push(config.Participation === null
        ? {id: "participation", status: "todo", href: "/manage/participation-settings", detail: "participationPending"}
        : {id: "participation", status: "done", href: "/manage/participation-settings", detail: config.Participation === 1 ? "participationTeams" : "participationSolo", vars: {size: config.MaxTeamSize}});

    steps.push(config.Registration === 0
        ? {id: "registration", status: "optional", href: "/manage/registration", detail: "registrationClosed"}
        : {id: "registration", status: "done", href: "/manage/registration", detail: config.Registration === 1 ? "registrationApproval" : "registrationOpen"});

    steps.push(lifecycle.Configured
        ? {id: "schedule", status: "done", href: "/manage/schedule", detail: "scheduleSaved"}
        : {id: "schedule", status: "todo", href: "/manage/schedule", detail: "schedulePending"});

    if (attachments) {
        const active = attachments.filter(item => item.Status === 0);
        const blocked = active.filter(item => infrastructureMismatch(item, config.InfrastructureAllowed));
        steps.push(blocked.length > 0
            ? {id: "challenges", status: "blocked", href: "/manage/exercises", detail: "challengesBlocked", vars: {count: blocked.length}}
            : active.length === 0
                ? {id: "challenges", status: "todo", href: "/manage/exercises", detail: "challengesNone"}
                : {id: "challenges", status: "done", href: "/manage/exercises", detail: "challengesReady", vars: {count: active.length}});
    }

    steps.push({id: "scoring", status: "optional", href: "/manage/challenge-settings", detail: "scoringDefault"});

    if (content) {
        steps.push(content.LandingDraft
            ? {id: "pages", status: "todo", href: "/manage/content/landing", detail: "pagesDraft"}
            : {id: "pages", status: "done", href: "/manage/content/landing", detail: "pagesPublished"});
    }

    if (mail) {
        const sender = mail.Identity.Sender.Address || mail.Inherited.Sender.Address;
        steps.push(sender
            ? {id: "mail", status: "done", href: "/manage/mail", detail: "mailReady"}
            : {id: "mail", status: "optional", href: "/manage/mail", detail: "mailNoSender"});
    }

    steps.push({id: "results", status: "optional", href: "/manage/results-settings", detail: "resultsDefault"});

    if (config.InfrastructureAllowed) {
        const infra = lifecycle.Infrastructure;
        steps.push(infra.HasDynamicLabs && !infra.CanStart
            ? {id: "stands", status: "blocked", href: "/manage/labs", detail: "standsBlocked"}
            : infra.HasDynamicLabs
                ? {id: "stands", status: "done", href: "/manage/labs", detail: "standsReady"}
                : {id: "stands", status: "optional", href: "/manage/labs", detail: "standsNone"});
    }

    // Publishing waits for every required step before it.
    const open = steps.filter(step => step.status === "todo" || step.status === "blocked");
    steps.push(published
        ? {id: "publish", status: "done", href: "/manage/schedule", detail: "publishDone"}
        : open.length > 0
            ? {id: "publish", status: open.some(step => step.status === "blocked") ? "blocked" : "todo", href: "/manage/schedule", detail: "publishWaiting", vars: {count: open.length}}
            : {id: "publish", status: "todo", href: "/manage/schedule", detail: "publishReady"});
    return steps;
}

export type SetupSummary = {done: number; total: number; blocked: boolean; complete: boolean};

// Optional steps are outside the count: they never hold the event back.
export function summarizeSetup(steps: SetupStep[]): SetupSummary {
    const required = steps.filter(step => step.status !== "optional");
    const done = required.filter(step => step.status === "done").length;
    const blocked = required.some(step => step.status === "blocked");
    return {done, total: required.length, blocked, complete: !blocked && done === required.length};
}
