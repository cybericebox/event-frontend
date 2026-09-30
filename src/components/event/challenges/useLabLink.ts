"use client";

import {useRef, useState} from "react";
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
export function useLabLink(eventID: string, challengeID: string | undefined, moderators = false): {
    state: LabLinkState; busyKey: string | null; open: (device: string, port: number) => void; retry: () => void;
} {
    const [state, setState] = useState<LabLinkState>({status: "idle"});
    const [busyKey, setBusyKey] = useState<string | null>(null);
    const last = useRef<{device: string; port: number} | null>(null);

    function open(device: string, port: number) {
        if (!challengeID || busyKey) return;
        last.current = {device, port};
        const tab = window.open("about:blank", "_blank");
        if (!tab) {
            setState({status: "error", error: new PopupBlockedError()});
            return;
        }
        tab.opener = null;
        setState({status: "pending"});
        setBusyKey(`${device}:${port}`);
        openLabLink(eventID, challengeID, device, port, moderators)
            .then(link => {
                tab.location.href = link.url;
                setState({status: "idle"});
            })
            .catch(error => {
                tab.close();
                setState({status: "error", error});
            })
            .finally(() => setBusyKey(null));
    }

    return {state, busyKey, open, retry: () => { if (last.current) open(last.current.device, last.current.port); }};
}
