"use client";

import {useCallback, useLayoutEffect, useRef, useState} from "react";
import {useQueryClient} from "@tanstack/react-query";
import type {LabRuntime} from "@/api/manageLabs";
import type {LabLifecycle} from "@/api/labLifecycle";
import {labLifecycleKey} from "./labLifecycleCache";
import {labAccessScope, taskBoardKey} from "./labAccessScope";
import {ApiErrorCode} from "@/api/apiErrors";
import {openLabLink, ParticipantChallengeError, type OwnBoard, type OwnChallenge} from "@/api/participantChallenges";
import {t} from "@/i18n/t";

import {useParticipantPreview} from "../ParticipantPreview";
import {openPreviewLabLink} from "@/api/participantPreview";
import type {BoardMode} from "./ChallengeModal";

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
export function useLabLink(eventID: string, challengeID: string | undefined, moderators = false, lifecycle?: LabLifecycle, withdrawn = false, previewSelectionID?: string): {
    state: LabLinkState; busyKey: string | null; open: (device: string, port: number) => void; retry: () => void;
} {
    const client = useQueryClient();
    const preview = useParticipantPreview(eventID).active || previewSelectionID !== undefined;
    const mode: BoardMode = preview ? "preview" : moderators ? "moderators" : "participant";
    const [state, setState] = useState<LabLinkState>({status: "idle"});
    const [busyKey, setBusyKey] = useState<string | null>(null);
    const last = useRef<{device: string; port: number} | null>(null);
    const current = useRef({eventID, challengeID, moderators, lifecycle, withdrawn, previewSelectionID, mode});
    const pending = useRef<{tab: Window; cancelled: boolean; previewRunID?: string | null} | null>(null);

    const latestScope = useCallback(() => {
        const latest = current.current;
        const mode = latest.mode;
        const raw = client.getQueryData<LabRuntime>(["event-challenge-lab", mode, latest.eventID, latest.challengeID]);
        const board = client.getQueryData<OwnBoard | OwnChallenge[]>(taskBoardKey(mode, latest.eventID));
        const task = board && !Array.isArray(board) ? board.Challenges.find(item => item.EventChallengeID === latest.challengeID) : undefined;
        const boardWithdrawn = !latest.moderators && !!task && (task.Closed || (board && !Array.isArray(board) && board.Stages.some(stage => stage.ID === task.StageID && stage.State === "closed")));
        const previewExpired = mode === "preview" && !!task?.PreviewExpiresAt && Date.parse(task.PreviewExpiresAt) <= Date.now();
        return {...latest, previewRunID: mode === "preview" ? task?.PreviewRunID : undefined,
            withdrawn: latest.withdrawn || !!boardWithdrawn || previewExpired || (mode === "preview" && (!!board && !task?.PreviewRunID || raw?.Ready !== true)),
            ...labAccessScope(client, mode, latest.eventID, latest.challengeID, latest.lifecycle, raw)};
    }, [client]);

    useLayoutEffect(() => {
        current.current = {eventID, challengeID, moderators, lifecycle, withdrawn, previewSelectionID, mode};
    }, [eventID, challengeID, moderators, lifecycle, withdrawn, previewSelectionID, mode]);

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
        // Read the current task attachment synchronously, before React's board observer rerenders.
        const unsubscribe = client.getQueryCache().subscribe(event => {
            const key = event.query.queryKey;

            const boardKey = taskBoardKey(mode, eventID);
            const boardEvent = key[0] === boardKey[0] && key[1] === eventID;
            const scopeEvent = key[1] === mode && key[2] === eventID && (
                (key[0] === "event-lab-lifecycle") || (key[0] === "event-challenge-lab" && key[3] === challengeID));
            if (!boardEvent && !scopeEvent) return;
            const observed = latestScope();
            if (event.type === "removed") {
                if (boardEvent || key[0] === "event-challenge-lab" || key[3] === current.current.lifecycle?.ID) cancel();
            } else if (event.type === "updated" && (observed.withdrawn || observed.identityMismatch
                || (mode === "preview" && pending.current && observed.previewRunID !== pending.current.previewRunID)
                || observed.lifecycle?.ID !== current.current.lifecycle?.ID
                || observed.lifecycle?.Revision !== current.current.lifecycle?.Revision
                || observed.lifecycle?.LogicalClosed || (observed.lifecycle && observed.lifecycle.RuntimeState !== "ready"))) cancel();
        });
        return () => {unsubscribe(); cancel();};
    }, [client, latestScope, eventID, challengeID, moderators, lifecycle?.ID, lifecycle?.Revision, lifecycle?.LogicalClosed, lifecycle?.RuntimeState, withdrawn, mode]);

    function open(device: string, port: number) {
        const latest = latestScope();
        if (latest.withdrawn || !latest.challengeID || latest.identityMismatch || pending.current || (latest.lifecycle && (latest.lifecycle.LogicalClosed || latest.lifecycle.RuntimeState !== "ready"))) return;
        const requested = {...latest, revision: latest.lifecycle?.Revision ?? null};
        last.current = {device, port};
        const tab = window.open("about:blank", "_blank");
        if (!tab) {
            setState({status: "error", error: new PopupBlockedError()});
            return;
        }
        tab.opener = null;
        const request = {tab, cancelled: false, previewRunID: latest.previewRunID};
        pending.current = request;
        const cache = client.getQueryCache();
        const scope = cache.find({queryKey: latest.lifecycle
            ? labLifecycleKey(mode, eventID, latest.lifecycle.ID)
            : ["event-challenge-lab", mode, eventID, latest.challengeID], exact: true});
        const active = () => !request.cancelled && pending.current === request
            && (!scope || cache.find({queryKey: scope.queryKey, exact: true}) === scope);
        setState({status: "pending"});
        setBusyKey(`${device}:${port}`);
        const fetchLink = preview ? openPreviewLabLink(eventID, previewSelectionID ?? "", device, port) : latest.lifecycle
            ? openLabLink(eventID, latest.challengeID, device, port, moderators, latest.lifecycle)
            : openLabLink(eventID, latest.challengeID, device, port, moderators);
        fetchLink.then(link => {
            const latest = latestScope();
            const unsafe = !active() || latest.withdrawn || latest.identityMismatch || latest.eventID !== requested.eventID || latest.moderators !== requested.moderators
                || latest.previewRunID !== requested.previewRunID
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
                void client.refetchQueries({queryKey: taskBoardKey(mode, eventID), exact: true});
                void client.refetchQueries({queryKey: ["event-challenge-lab", mode, eventID, challengeID], exact: true});
            }
        }).finally(() => {
            if (pending.current !== request) return;
            pending.current = null;
            setBusyKey(null);
        });
    }

    return {state, busyKey, open, retry: () => { if (last.current) open(last.current.device, last.current.port); }};
}
