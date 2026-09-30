"use client";

import {useEffect, useState} from "react";
import {ApiErrorCode} from "@/api/apiErrors";
import {openLabSession, ParticipantChallengeError} from "@/api/participantChallenges";
import {t} from "@/i18n/t";

export type LabSessionState = {status: "idle" | "pending" | "ready"} | {status: "error"; error: unknown};

// A token lasts until the event's effective finish, so the session is requested
// once per event and again only after the remembered expiry passes.
const EXPIRY_MARGIN_MS = 60_000;
const known = new Map<string, number>();

export function resetLabSessionMemo() { known.clear(); }

export function labSessionErrorMessage(error: unknown): string {
    if (error instanceof ParticipantChallengeError) {
        if (error.code === ApiErrorCode.InfrastructureUnavailable) return t("challenges.lab.error.unavailable");
        if (error.code === ApiErrorCode.TeamNotAdmitted) return t("challenges.lab.error.notAdmitted");
        if (error.code === ApiErrorCode.ChallengeNotPublished) return t("challenges.lab.error.notPublished");
        if (error.code === ApiErrorCode.ParticipantNotApproved) return t("challenges.lab.error.notApproved");
    }
    return t("challenges.lab.error.failed");
}

// Opens the lab proxy cookie while `active` (a web task is open): one request the
// first time, none while the remembered expiry holds; a 401 is retried once, any
// other failure is shown with a retry that always asks the server again. The
// cookie lives on the lab domain, only its expiry is kept here.
export function useLabSession(eventID: string, challengeID: string | undefined, active: boolean, moderators = false): {state: LabSessionState; retry: () => void} {
    const [state, setState] = useState<LabSessionState>({status: "idle"});
    const [attempt, setAttempt] = useState(0);
    const running = active && !!challengeID;

    useEffect(() => {
        if (!running || !challengeID) return;
        const key = `${eventID}:${moderators ? "m" : "p"}`;
        let stopped = false;
        async function run() {
            if (attempt === 0 && (known.get(key) ?? 0) - EXPIRY_MARGIN_MS > Date.now()) {
                setState({status: "ready"});
                return;
            }
            setState({status: "pending"});
            try {
                let session;
                try {
                    session = await openLabSession(eventID, challengeID!, moderators);
                } catch (error) {
                    if (!(error instanceof ParticipantChallengeError) || error.status !== 401) throw error;
                    session = await openLabSession(eventID, challengeID!, moderators);
                }
                known.set(key, session.expiresAt);
                if (!stopped) setState({status: "ready"});
            } catch (error) {
                known.delete(key);
                if (!stopped) setState({status: "error", error});
            }
        }
        void run();
        return () => { stopped = true; };
    }, [eventID, challengeID, running, moderators, attempt]);

    return {state: running ? state : {status: "idle"}, retry: () => setAttempt(value => value + 1)};
}
