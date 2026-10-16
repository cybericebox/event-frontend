"use client";

import {useSessionDraftState} from "@/components/event/manage/manualDraft";

import {useState, type FormEvent} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import toast from "react-hot-toast";
import {getManageTeamFields} from "@/api/manageTeamFields";
import {useParticipantPreview, participantPreviewForm} from "../ParticipantPreview";
import {createEventTeam, getSelfTeamFields, joinEventTeam} from "@/api/eventTeams";
import type {ParticipantAnswers} from "@/api/participantForm";
import type {PublicEventInfo} from "@/api/publicEventInfo";
import {DialogModal} from "@/components/event/DialogModal";
import {EventBanner} from "@/components/event/EventBanner";
import {EventLoadError} from "@/components/event/EventLoadError";
import {TeamFieldsInputs} from "@/components/event/TeamFieldsInputs";
import {EventButton} from "@/components/ui/EventButton";
import {t} from "@/i18n/t";
import {Card} from "./participationBlocks";
import {forgetJoinCode, parseJoinCode} from "./participationModel";
import {errorText} from "./participationParts";

// No team yet: create one or join with a link or a code.
export function NoTeam({event, rosterOpen, closedReason, linkCode, preview, createReason = "", joinReason = ""}: {event: PublicEventInfo; rosterOpen: boolean; closedReason: string; linkCode: string; preview: boolean; createReason?: string; joinReason?: string}) {
    const simulation = useParticipantPreview(event.EventID);
    const queryClient = useQueryClient();
    const [code, setCode] = useSessionDraftState("team-join-code", linkCode);
    const [name, setName] = useSessionDraftState("create-team-name", "");
    const [fields, setFields] = useSessionDraftState<ParticipantAnswers>("create-team-fields", {});
    const [createOpen, setCreateOpen] = useSessionDraftState("create-team-open", false, {dirty: () => false});
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const fieldsQuery = useQuery({queryKey: [simulation.active ? "event-management-team-fields" : "event-team-fields", event.EventID], queryFn: () => simulation.active ? getManageTeamFields(event.EventID) : getSelfTeamFields(), select: simulation.active ? participantPreviewForm : undefined, enabled: createOpen && (!preview || simulation.active), refetchOnWindowFocus: false});
    const refresh = () => Promise.all([
        queryClient.invalidateQueries({queryKey: ["event-own-team", event.EventID]}),
        queryClient.invalidateQueries({queryKey: ["event-participant-info", event.EventID]}),
    ]);
    if (!rosterOpen) return <p className="event-part__note">{closedReason || t("participation.noTeam.frozen")}</p>;
    const join = async (submit: FormEvent) => {
        submit.preventDefault();
        if (simulation.active) { simulation.update({team: {ID: crypto.randomUUID(), Name: t("participantPreview.joinedTeam"), Role: 1, MemberCount: 2, MinTeamSize: simulation.config?.MinTeamSize, MaxTeamSize: simulation.config?.MaxTeamSize, CaptainID: crypto.randomUUID(), JoinCode: "", JoinCodeExpiresAt: null, ExtraFields: {}, Admitted: true, Formed: false}}); return; }
        if (preview) { toast(t("participation.preview.noChanges")); return; }
        setBusy(true);
        setError("");
        try {
            await joinEventTeam(event.EventID, parseJoinCode(code));
            setCode(linkCode);
            forgetJoinCode();
            await refresh();
        } catch (failure) {
            // JoinTeam: 404 = unknown link; 409 = full team, expired link or closed roster.
            setError(errorText(failure, t("participation.noTeam.joinFailed")));
        } finally { setBusy(false); }
    };
    const create = async (submit: FormEvent) => {
        submit.preventDefault();
        if (simulation.active) { simulation.update({team: {ID: crypto.randomUUID(), Name: name.trim(), Role: 0, CaptainID: simulation.state!.userID, MemberCount: 1, MinTeamSize: simulation.config?.MinTeamSize, MaxTeamSize: simulation.config?.MaxTeamSize, JoinCode: `preview-${crypto.randomUUID()}`, JoinCodeExpiresAt: null, ExtraFields: fields, Admitted: true, Formed: false}}); setName(""); setFields({}); setCreateOpen(false); return; }
        if (preview) { toast(t("participation.preview.noChanges")); return; }
        setBusy(true);
        setError("");
        try {
            await createEventTeam(event.EventID, name.trim(), fields);
            setName(""); setFields({}); setCreateOpen(false);
            await refresh();
        } catch (failure) {
            setError(errorText(failure, t("participation.noTeam.createFailed")));
        } finally { setBusy(false); }
    };
    return <>
        {linkCode && <div className="event-participation__banners ib-banner-stack"><EventBanner tone="info" title={t("participation.noTeam.linkTitle")} message={t("participation.noTeam.linkMessage")} /></div>}
        <div className="event-pp-choice">
            <Card title={t("participation.noTeam.create")}><p className="event-pp-invite__note">{t("participation.noTeam.createNote")}</p><div className="event-part__actions"><button type="button" className="ib-btn ib-btn--primary" disabled={!!createReason} onClick={() => { setError(""); setCreateOpen(true); }}>{t("participation.noTeam.create")}</button></div>{createReason && <p className="event-part__note">{createReason}</p>}</Card>
            <Card title={t("participation.noTeam.joinTitle")}><p className="event-pp-invite__note">{t("participation.noTeam.joinNote")}</p>
                <form className="event-part__inline" onSubmit={event => void join(event)}>
                    <input className="ib-input ib-input--mono" value={code} onChange={event => setCode(event.target.value)} aria-label={t("participation.noTeam.code")} placeholder={t("participation.noTeam.code")} required autoComplete="off" disabled={busy} />
                    <button type="submit" className="ib-btn" disabled={busy || !!joinReason || !parseJoinCode(code)}>{t("participation.noTeam.join")}</button>
                </form>
                {joinReason && <p className="event-part__note">{joinReason}</p>}
            </Card>
        </div>
        {error && !createOpen && <p className="ib-cmodal__msg is-error" role="alert">{error}</p>}
        <DialogModal open={createOpen} onClose={() => { if (!busy) setCreateOpen(false); }} title={t("participation.noTeam.create")} description={t("participation.noTeam.createDescription")}>
            <form className="event-part__form" onSubmit={event => void create(event)}>
                <label className="ib-field"><span className="ib-field__label">{t("participation.team.name")}</span><input className="ib-input" value={name} onChange={event => setName(event.target.value)} required minLength={3} maxLength={64} disabled={busy} autoFocus /></label>
                {fieldsQuery.data?.Enabled && <TeamFieldsInputs form={fieldsQuery.data} answers={fields} onChange={(key, value) => setFields(current => ({...current, [key]: value}))} disabled={busy} />}
                {fieldsQuery.isError && <EventLoadError compact message={t("participation.noTeam.fieldsFailed")} error={fieldsQuery.error} onRetry={() => void fieldsQuery.refetch()} />}
                {error && <p className="ib-cmodal__msg is-error" role="alert">{error}</p>}
                <div className="event-part__actions"><EventButton type="submit" className="ib-btn ib-btn--primary" disabled={busy || (fieldsQuery.isPending && (!preview || simulation.active))} busy={busy}>{t("participation.noTeam.createAction")}</EventButton></div>
            </form>
        </DialogModal>
    </>;
}
