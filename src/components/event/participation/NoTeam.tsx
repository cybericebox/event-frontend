"use client";

import {useSessionDraftState} from "@/components/event/manage/manualDraft";

import {useRef, useState, type FormEvent} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import toast from "react-hot-toast";
import {getManageTeamFields} from "@/api/manageTeamFields";
import {useParticipantPreview, participantPreviewForm} from "../ParticipantPreview";
import {ApiErrorCode} from "@/api/apiErrors";
import {createEventTeam, getSelfTeamFields, joinEventTeam} from "@/api/eventTeams";
import type {ParticipantAnswers} from "@/api/participantForm";
import type {PublicEventInfo} from "@/api/publicEventInfo";
import {DialogModal} from "@/components/event/DialogModal";
import {EventBanner} from "@/components/event/EventBanner";
import {EventLoadError} from "@/components/event/EventLoadError";
import {TeamFieldsInputs} from "@/components/event/TeamFieldsInputs";
import {collectFormAnswers} from "@/components/event/ParticipantFormFields";
import {EventButton} from "@/components/ui/EventButton";
import {t} from "@/i18n/t";
import {Card} from "./participationBlocks";
import {forgetJoinCode, parseJoinCode} from "./participationModel";
import {errorText} from "./participationParts";

const MIN_NAME = 3;

// The create-team form checks itself (no browser bubbles in the browser's language): the name, then the
// required team questions. Each message goes under its own field.
export function createTeamErrors(name: string, form: Parameters<typeof collectFormAnswers>[0], fields: ParticipantAnswers): {name?: string; fields: Record<string, string>} {
    const trimmed = name.trim();
    const nameError = !trimmed ? t("participation.noTeam.nameRequired") : trimmed.length < MIN_NAME ? t("participation.noTeam.nameShort", {count: MIN_NAME}) : undefined;
    const fieldErrors = form?.Enabled && form.Required ? collectFormAnswers(form, fields).errors ?? {} : {};
    return {name: nameError, fields: fieldErrors};
}

// No team yet: one card to join with a link or a code, and below it the way to create a team.
export function NoTeam({event, rosterOpen, closedReason, linkCode, preview, createReason = "", joinReason = ""}: {event: PublicEventInfo; rosterOpen: boolean; closedReason: string; linkCode: string; preview: boolean; createReason?: string; joinReason?: string}) {
    const simulation = useParticipantPreview(event.EventID);
    const queryClient = useQueryClient();
    const [code, setCode] = useSessionDraftState("team-join-code", linkCode);
    const [name, setName] = useSessionDraftState("create-team-name", "");
    const [fields, setFields] = useSessionDraftState<ParticipantAnswers>("create-team-fields", {});
    const [createOpen, setCreateOpen] = useSessionDraftState("create-team-open", false, {dirty: () => false});
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [fieldError, setFieldError] = useState<{field: "name" | "code"; message: string} | null>(null);
    const [teamFieldErrors, setTeamFieldErrors] = useState<Record<string, string>>({});
    const createForm = useRef<HTMLFormElement>(null);
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
        setFieldError(null);
        try {
            await joinEventTeam(event.EventID, parseJoinCode(code));
            setCode(linkCode);
            forgetJoinCode();
            await refresh();
        } catch (failure) {
            // JoinTeam: 404 = unknown link; 409 = full team, expired link or closed roster.
            const code = failure && typeof failure === "object" && "code" in failure ? failure.code : undefined;
            const message = errorText(failure, t("participation.noTeam.joinFailed"));
            if (code === ApiErrorCode.TeamNotFound || code === ApiErrorCode.TeamInvitationUnavailable || code === ApiErrorCode.InvitationExpired) setFieldError({field: "code", message});
            else setError(message);
        } finally { setBusy(false); }
    };
    const create = async (submit: FormEvent) => {
        submit.preventDefault();
        const invalid = createTeamErrors(name, fieldsQuery.data, fields);
        setFieldError(invalid.name ? {field: "name", message: invalid.name} : null);
        setTeamFieldErrors(invalid.fields);
        if (invalid.name || Object.keys(invalid.fields).length) {
            requestAnimationFrame(() => {
                const first = createForm.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
                (first?.matches("input,textarea,select,button") ? first : first?.querySelector<HTMLElement>("input,textarea,select,button") ?? first)?.focus();
            });
            return;
        }
        if (simulation.active) { simulation.update({team: {ID: crypto.randomUUID(), Name: name.trim(), Role: 0, CaptainID: simulation.state!.userID, MemberCount: 1, MinTeamSize: simulation.config?.MinTeamSize, MaxTeamSize: simulation.config?.MaxTeamSize, JoinCode: `preview-${crypto.randomUUID()}`, JoinCodeExpiresAt: null, ExtraFields: fields, Admitted: true, Formed: false}}); setName(""); setFields({}); setCreateOpen(false); return; }
        if (preview) { toast(t("participation.preview.noChanges")); return; }
        setBusy(true);
        setError("");
        setFieldError(null);
        try {
            await createEventTeam(event.EventID, name.trim(), fields);
            setName(""); setFields({}); setCreateOpen(false);
            await refresh();
        } catch (failure) {
            const code = failure && typeof failure === "object" && "code" in failure ? failure.code : undefined;
            const message = errorText(failure, t("participation.noTeam.createFailed"));
            if (code === ApiErrorCode.TeamNameInvalid || code === ApiErrorCode.TeamExists || code === ApiErrorCode.NameInvalidCharacters) setFieldError({field: "name", message});
            else setError(message);
        } finally { setBusy(false); }
    };
    return <>
        {linkCode && <div className="event-participation__banners ib-banner-stack"><EventBanner tone="info" title={t("participation.noTeam.linkTitle")} message={t("participation.noTeam.linkMessage")} /></div>}
        <Card title={t("participation.noTeam.joinTitle")}>
            <p className="event-pp-invite__note">{t("participation.noTeam.joinNote")}</p>
            <form className="event-part__inline event-pp-join" noValidate onSubmit={event => void join(event)}>
                <div className="ib-field"><input className="ib-input ib-input--mono" type="text" aria-invalid={fieldError?.field === "code" || undefined} aria-describedby={fieldError?.field === "code" ? "team-join-code-error" : undefined} value={code} onChange={event => {setCode(event.target.value); setFieldError(null);}} aria-label={t("participation.noTeam.code")} placeholder={t("participation.noTeam.code")} autoComplete="off" disabled={busy} />{fieldError?.field === "code" && <p className="ib-field__error" id="team-join-code-error" role="alert">{fieldError.message}</p>}</div>
                <button type="submit" className="ib-btn ib-btn--primary" disabled={busy || !!joinReason || !parseJoinCode(code)}>{t("participation.noTeam.join")}</button>
            </form>
            {error && !createOpen && <p className="ib-cmodal__msg is-error" role="alert">{error}</p>}
            {joinReason && <p className="event-part__note">{joinReason}</p>}
            <div className="event-pp-create">
                <p className="event-pp-invite__note">{t("participation.noTeam.orCreate")}</p>
                <button type="button" className="ib-btn" disabled={!!createReason} onClick={() => { setError(""); setFieldError(null); setTeamFieldErrors({}); setCreateOpen(true); }}>{t("participation.noTeam.create")}</button>
            </div>
            {createReason && <p className="event-part__note">{createReason}</p>}
        </Card>
        <DialogModal open={createOpen} onClose={() => { if (!busy) setCreateOpen(false); }} title={t("participation.noTeam.create")} description={t("participation.noTeam.createDescription")}>
            <form ref={createForm} className="event-part__form" noValidate onSubmit={event => void create(event)}>
                <label className="ib-field"><span className="ib-field__label">{t("participation.team.name")}</span><input className="ib-input" aria-invalid={fieldError?.field === "name" || undefined} aria-describedby={fieldError?.field === "name" ? "create-team-name-error" : undefined} value={name} onChange={event => {setName(event.target.value); setFieldError(null);}} maxLength={64} disabled={busy} autoFocus />{fieldError?.field === "name" && <span className="ib-field__error" id="create-team-name-error" role="alert">{fieldError.message}</span>}</label>
                {fieldsQuery.data?.Enabled && <TeamFieldsInputs form={fieldsQuery.data} answers={fields} errors={teamFieldErrors} onChange={(key, value) => {setFields(current => ({...current, [key]: value})); setTeamFieldErrors(current => { const next = {...current}; delete next[key]; return next; });}} disabled={busy} />}
                {fieldsQuery.isError && <EventLoadError compact message={t("participation.noTeam.fieldsFailed")} error={fieldsQuery.error} onRetry={() => void fieldsQuery.refetch()} />}
                {error && <p className="ib-cmodal__msg is-error" role="alert">{error}</p>}
                <div className="event-part__actions"><EventButton type="submit" className="ib-btn ib-btn--primary" disabled={busy || (fieldsQuery.isPending && (!preview || simulation.active))} busy={busy} busyLabel={t("common.busy.creating")}>{t("participation.noTeam.createAction")}</EventButton></div>
            </form>
        </DialogModal>
    </>;
}
