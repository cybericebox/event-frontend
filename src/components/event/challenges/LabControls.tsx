"use client";

import {useRef, useState} from "react";
import {useQueryClient} from "@tanstack/react-query";
import type {LabLifecycle} from "@/api/labLifecycle";
import {apiErrorMessage} from "@/api/apiErrors";
import {ParticipantChallengeError, restartOwnLab, stopOwnLab} from "@/api/participantChallenges";
import {ConfirmDialog} from "@/components/ui/ConfirmDialog";
import {EventButton} from "@/components/ui/EventButton";
import {t} from "@/i18n/t";
import {labLifecycleKey, rememberLab, reconcileBoard} from "./labLifecycleCache";
import type {OwnBoard} from "@/api/participantChallenges";

type Operation = {action: "stop" | "restart"; eventID: string; labID: string; revision: string; key: string};

export function LabControls({eventID, lab, onRefresh}: {eventID: string; lab: LabLifecycle; onRefresh: () => void}) {
    const client = useQueryClient();
    const [confirm, setConfirm] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    // An uncertain transport outcome retries the same operation, including its revision.
    const operation = useRef<Operation | null>(null);
    const canStop = lab.CanStop && !lab.LogicalClosed && lab.SnapshotPolicy != null;
    const canRestart = lab.CanRestart && lab.LogicalClosed && lab.CloseReason === "manual";

    async function run(action: "stop" | "restart") {
        if (busy || (action === "stop" ? !canStop : !canRestart)) return;
        const previous = operation.current;
        const request = previous?.action === action && previous.eventID === eventID && previous.labID === lab.ID ? previous : {
            action, eventID, labID: lab.ID, revision: lab.Revision, key: crypto.randomUUID(),
        };
        operation.current = request;
        const cache = client.getQueryCache();
        const scope = cache.build<LabLifecycle>(client, {queryKey: labLifecycleKey("participant", request.eventID, request.labID), gcTime: Infinity});
        const currentSession = () => cache.find({queryKey: scope.queryKey, exact: true}) === scope;
        setBusy(true);
        setError("");
        try {
            const accepted = await (action === "stop" ? stopOwnLab : restartOwnLab)(request.eventID, request.labID, request.revision, request.key);
            if (!currentSession()) return;
            // The response is the sole authority for withdrawing or preparing access.
            rememberLab(client, "participant", request.eventID, accepted);
            client.setQueryData<OwnBoard>(["event-own-challenges", request.eventID], board => board && reconcileBoard(client, "participant", request.eventID, board));
            operation.current = null;
            setConfirm(false);
        } catch (failure) {
            if (!currentSession()) return;
            if (failure instanceof ParticipantChallengeError && (failure.status === 403 || failure.status === 409)) {
                operation.current = null;
                onRefresh();
                setError(apiErrorMessage(failure.code, t("challenges.lab.stateChanged")));
            } else {
                setError(t("challenges.lab.changeFailed"));
            }
        } finally {if (currentSession()) setBusy(false);}
    }

    if (!canStop && !canRestart && !confirm) return null;
    return <div className="ib-cmodal__row">
        {canStop && <EventButton className="ib-btn ib-btn--sm" onClick={() => {setError(""); setConfirm(true);}}>{t("challenges.lab.stop.confirm")}</EventButton>}
        {canRestart && <EventButton className="ib-btn ib-btn--sm ib-btn--primary" busy={busy} onClick={() => void run("restart")}>{t("challenges.lab.restart")}</EventButton>}
        {!confirm && error && <p className="ib-cmodal__msg is-warn" role="alert">{error}</p>}
        <ConfirmDialog open={confirm && canStop} onCancel={() => setConfirm(false)} title={t("challenges.lab.stop.title")}
            description={t(lab.SnapshotPolicy === "required" ? "challenges.lab.stop.requiredBody" : "challenges.lab.stop.noneBody")}
            tone="danger" confirmLabel={t("challenges.lab.stop.confirm")} busy={busy} error={error} onConfirm={() => void run("stop")} />
    </div>;
}
