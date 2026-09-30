"use client";

import {useEffect, useState} from "react";
import {ApiErrorCode} from "@/api/apiErrors";
import {openLabSession, ParticipantChallengeError} from "@/api/participantChallenges";
import {t} from "@/i18n/t";

export type LabSessionState = {status: "idle" | "pending" | "ready"} | {status: "error"; error: unknown};

// The refresh runs at this share of the session's remaining time, so the cookie never lapses under an open task.
export const LAB_SESSION_REFRESH_SHARE = 0.8;
const MIN_DELAY_MS = 5000;

export function labSessionErrorMessage(error: unknown): string {
    if (error instanceof ParticipantChallengeError) {
        if (error.code === ApiErrorCode.InfrastructureUnavailable) return t("challenges.lab.error.unavailable");
        if (error.code === ApiErrorCode.TeamNotAdmitted) return t("challenges.lab.error.notAdmitted");
        if (error.code === ApiErrorCode.ChallengeNotPublished) return t("challenges.lab.error.notPublished");
        if (error.code === ApiErrorCode.ParticipantNotApproved) return t("challenges.lab.error.notApproved");
    }
    return t("challenges.lab.error.failed");
}

// Keeps the lab proxy cookie alive while `active` (a web task is open): one call
// on start, then a silent renewal at 80% of the lifetime; a hidden tab waits
// until it is visible again. The cookie lives on the lab domain, nothing is kept here.
export function useLabSession(eventID: string, challengeID: string | undefined, active: boolean, moderators = false): {state: LabSessionState; retry: () => void} {
    const [state, setState] = useState<LabSessionState>({status: "idle"});
    const [attempt, setAttempt] = useState(0);
    const running = active && !!challengeID;

    useEffect(() => {
        if (!running || !challengeID) return;
        let stopped = false;
        let timer: number | undefined;
        let waitingVisible = false;

        const onVisible = () => {
            if (document.visibilityState === "visible" && waitingVisible) {
                waitingVisible = false;
                void run(true);
            }
        };
        async function run(silent: boolean) {
            if (!silent) setState({status: "pending"});
            try {
                const {expiresAt} = await openLabSession(eventID, challengeID!, moderators);
                if (stopped) return;
                setState({status: "ready"});
                const delay = Math.max(MIN_DELAY_MS, (expiresAt - Date.now()) * LAB_SESSION_REFRESH_SHARE);
                timer = window.setTimeout(() => {
                    if (document.visibilityState === "hidden") waitingVisible = true;
                    else void run(true);
                }, delay);
            } catch (error) {
                if (!stopped) setState({status: "error", error});
            }
        }
        document.addEventListener("visibilitychange", onVisible);
        void run(false);
        return () => {
            stopped = true;
            window.clearTimeout(timer);
            document.removeEventListener("visibilitychange", onVisible);
        };
    }, [eventID, challengeID, running, moderators, attempt]);

    return {state: running ? state : {status: "idle"}, retry: () => setAttempt(value => value + 1)};
}
