"use client";

import {useCallback, useEffect, useRef, useState} from "react";
import {saveManageLiveDraft, type LiveLayout} from "@/api/manageLive";

export type LiveSaveState = "saved" | "pending" | "saving" | "error" | "invalid";

export const liveAutosaveDelay = 800;
export const liveAutosaveRetryDelay = 5000;

// The editor keeps the draft saved on its own: every valid change is written
// shortly after the last edit. The draft is never shown on the screen until
// «Опублікувати», so saving it silently is safe.
export function useLiveAutosave({eventID, layout, savedJSON, valid, enabled, onSaved}: {
    eventID: string; layout: LiveLayout | null; savedJSON: string; valid: boolean; enabled: boolean; onSaved: (layout: LiveLayout) => void;
}) {
    const [state, setState] = useState<{json: string; status: "saving" | "error" | "idle"}>({json: savedJSON, status: "idle"});
    const lastSaved = useRef(savedJSON);
    const [savedBody, setSavedBody] = useState(savedJSON);
    const inFlight = useRef<Promise<boolean> | null>(null);
    const latest = useRef({layout, onSaved});
    useEffect(() => { latest.current = {layout, onSaved}; });
    const json = layout ? JSON.stringify(layout) : savedJSON;

    const save = useCallback(async (): Promise<boolean> => {
        const current = latest.current.layout;
        if (!current) return true;
        const body = JSON.stringify(current);
        if (body === lastSaved.current) return true;
        if (inFlight.current) await inFlight.current;
        if (body === lastSaved.current) return true;
        setState({json: body, status: "saving"});
        const request = saveManageLiveDraft(eventID, current).then(() => {
            lastSaved.current = body;
            setSavedBody(body);
            latest.current.onSaved(current);
            setState(value => value.json === body ? {json: body, status: "idle"} : value);
            return true;
        }, () => {
            setState({json: body, status: "error"});
            return false;
        }).finally(() => {inFlight.current = null;});
        inFlight.current = request;
        return request;
    }, [eventID]);

    useEffect(() => {
        if (!enabled || !valid || json === savedBody) return;
        const timer = setTimeout(() => void save(), liveAutosaveDelay);
        return () => clearTimeout(timer);
    }, [enabled, valid, json, savedBody, save]);

    // A failed save is retried on its own, so a brief network drop does not leave the draft unsaved.
    const failed = state.status === "error" && state.json === json;
    useEffect(() => {
        if (!enabled || !valid || !failed || json === savedBody) return;
        const timer = setTimeout(() => void save(), liveAutosaveRetryDelay);
        return () => clearTimeout(timer);
    }, [enabled, valid, failed, json, savedBody, save]);

    const dirty = json !== savedBody;
    useEffect(() => {
        if (!dirty) return;
        const warn = (event: BeforeUnloadEvent) => event.preventDefault();
        window.addEventListener("beforeunload", warn);
        return () => window.removeEventListener("beforeunload", warn);
    }, [dirty]);

    const status: LiveSaveState = !dirty ? "saved" : !valid ? "invalid" : state.json === json && state.status === "error" ? "error" : state.json === json && state.status === "saving" ? "saving" : "pending";
    // Saves pending edits now (before publishing); false when saving failed.
    const flush = useCallback(async () => valid ? save() : false, [valid, save]);
    return {status, flush, retry: () => void save()};
}
