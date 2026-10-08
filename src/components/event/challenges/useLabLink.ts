"use client";

import {useLayoutEffect, useRef, useState} from "react";
import {useQueryClient} from "@tanstack/react-query";
import type {LabRuntime} from "@/api/manageLabs";
import type {LabLifecycle} from "@/api/labLifecycle";
import {labLifecycleKey, newestLab} from "./labLifecycleCache";
import {ApiErrorCode} from "@/api/apiErrors";
import {openLabLink, ParticipantChallengeError} from "@/api/participantChallenges";
import {t} from "@/i18n/t";

export type LabLinkState = {status: "idle" | "pending"} | {status: "error"; error: unknown};

export class PopupBlockedError extends Error {}

export function labLinkErrorMessage(error: unknown): string {
    if (error instanceof PopupBlockedError) return t("challenges.lab.error.popupBlocked");
    if (error instanceof ParticipantChallengeError) {
        if (error.code === ApiErrorCode.InfrastructureUnavailable) return t("challenges.lab.error.unavailable");
        if (error.code === ApiErrorCode.TeamNotAdmitted) return t("challenges.lab.error.notAdmitted");
        if (error.code === ApiErrorCode.ChallengeNotPublished) return t("challenges.lab.error.notPublished");
        if (error.code === ApiErrorCode.ParticipantNotApproved) return t("challenges.lab.error.notApproved");
        if (error.code === ApiErrorCode.StandLabClientMissing) return t("challenges.lab.error.clientMissing");
    }
    return t("challenges.lab.error.failed");
}

// Opens one web device of a task's lab. The link is fetched on every click (it is
// short-lived and single use), so no session is kept here. The tab is opened
// synchronously inside the click, before the request, so the browser treats it as
// user-initiated; its location is set once the link arrives.
export function useLabLink(eventID: string, challengeID: string | undefined, moderators = false, lifecycle?: LabLifecycle): {
    state: LabLinkState; busyKey: string | null; open: (device: string, port: number) => void; retry: () => void;
} {
    const client = useQueryClient();
    const [state, setState] = useState<LabLinkState>({status: "idle"});
    const [busyKey, setBusyKey] = useState<string | null>(null);
    const last = useRef<{device: string; port: number} | null>(null);
    const current = useRef({eventID, challengeID, moderators, lifecycle});
    const pending = useRef<{tab: Window; cancelled: boolean} | null>(null);

    useLayoutEffect(() => {
        current.current = {eventID, challengeID, moderators, lifecycle};
    }, [eventID, challengeID, moderators, lifecycle]);

    useLayoutEffect(() => {
        function cancel() {
            if (pending.current) {
                pending.current.cancelled = true;
                pending.current.tab.close();
                pending.current = null;
            }
            last.current = null;
            setState({status: "idle"});
            setBusyKey(null);
        }
        // A cache removal (including logout clear) invalidates this session's link.
        const unsubscribe = client.getQueryCache().subscribe(event => {
            const key = event.query.queryKey;
            const mode = moderators ? "moderators" : "participant";
            if (key[1] !== mode || key[2] !== eventID) return;
            if (key[0] === "event-lab-lifecycle" && key[3] === lifecycle?.ID) {
                if (event.type === "removed") cancel();
                else if (event.type === "updated" && event.query.state.data) {
                    const observed = newestLab(current.current.lifecycle, event.query.state.data as LabLifecycle);
                    if (observed.LogicalClosed || observed.RuntimeState !== "ready" || observed.Revision !== lifecycle?.Revision) cancel();
                }
            } else if (key[0] === "event-challenge-lab" && key[3] === challengeID) {
                if (event.type === "removed") cancel();
                else if (event.type === "updated") {
                    const raw = (event.query.state.data as LabRuntime | undefined)?.Lab;
                    if (raw) {
                        const observed = newestLab(current.current.lifecycle, raw);
                        if (!current.current.lifecycle || observed.LogicalClosed || observed.RuntimeState !== "ready"
                            || observed.ID !== lifecycle?.ID || observed.Revision !== lifecycle?.Revision) cancel();
                    }
                }
            }
        });
        return () => {unsubscribe(); cancel();};
    }, [client, eventID, challengeID, moderators, lifecycle?.ID, lifecycle?.Revision, lifecycle?.LogicalClosed, lifecycle?.RuntimeState]);

    function latestScope() {
        const latest = current.current;
        const mode = latest.moderators ? "moderators" : "participant";
        const raw = client.getQueryData<LabRuntime>(["event-challenge-lab", mode, latest.eventID, latest.challengeID])?.Lab;
        const attached = raw ? newestLab(latest.lifecycle, raw) : latest.lifecycle;
        const shared = attached && client.getQueryData<LabLifecycle>(labLifecycleKey(mode, latest.eventID, attached.ID));
        return {...latest, lifecycle: shared && attached ? newestLab(attached, shared) : attached};
    }

    function open(device: string, port: number) {
        const latest = latestScope();
        if (!latest.challengeID || pending.current || (latest.lifecycle && (latest.lifecycle.LogicalClosed || latest.lifecycle.RuntimeState !== "ready"))) return;
        const requested = {...latest, revision: latest.lifecycle?.Revision ?? null};
        last.current = {device, port};
        const tab = window.open("about:blank", "_blank");
        if (!tab) {
            setState({status: "error", error: new PopupBlockedError()});
            return;
        }
        tab.opener = null;
        const request = {tab, cancelled: false};
        pending.current = request;
        const cache = client.getQueryCache();
        const scope = cache.find({queryKey: latest.lifecycle
            ? labLifecycleKey(moderators ? "moderators" : "participant", eventID, latest.lifecycle.ID)
            : ["event-challenge-lab", moderators ? "moderators" : "participant", eventID, latest.challengeID], exact: true});
        const active = () => !request.cancelled && pending.current === request
            && (!scope || cache.find({queryKey: scope.queryKey, exact: true}) === scope);
        setState({status: "pending"});
        setBusyKey(`${device}:${port}`);
        const fetchLink = latest.lifecycle
            ? openLabLink(eventID, latest.challengeID, device, port, moderators, latest.lifecycle)
            : openLabLink(eventID, latest.challengeID, device, port, moderators);
        fetchLink.then(link => {
            const latest = latestScope();
            const unsafe = !active() || latest.eventID !== requested.eventID || latest.moderators !== requested.moderators
                || latest.challengeID !== requested.challengeID || (requested.revision === null
                    ? !!latest.lifecycle
                    : !latest.lifecycle || latest.lifecycle.LogicalClosed || latest.lifecycle.RuntimeState !== "ready"
                        || latest.lifecycle.ID !== link.labID || latest.lifecycle.ID !== requested.lifecycle?.ID
                        || latest.lifecycle.Revision !== requested.revision || link.revision !== requested.revision);
            if (unsafe) {
                tab.close();
                if (active()) {last.current = null; setState({status: "idle"});}
                return;
            }
            tab.location.href = link.url;
            setState({status: "idle"});
        }).catch(error => {
            tab.close();
            if (!active()) return;
            setState({status: "error", error});
            if (error instanceof ParticipantChallengeError && (error.status === 403 || error.status === 409)) {
                void client.refetchQueries({queryKey: [moderators ? "event-moderators-board" : "event-own-challenges", eventID], exact: true});
                void client.refetchQueries({queryKey: ["event-challenge-lab", moderators ? "moderators" : "participant", eventID, challengeID], exact: true});
            }
        }).finally(() => {
            if (pending.current !== request) return;
            pending.current = null;
            setBusyKey(null);
        });
    }

    return {state, busyKey, open, retry: () => { if (last.current) open(last.current.device, last.current.port); }};
}
