"use client";

import {useSessionDraftState} from "@/components/event/manage/manualDraft";
import {useRevealFirstError} from "@/components/event/manage/useRevealFirstError";

import {useMemo, useRef, useState, type FocusEvent} from "react";
import {useDraftRouter as useRouter} from "@/components/event/manage/manualDraft";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import Link from "next/link";
import {ArrowLeft, BookmarkPlus, Send} from "lucide-react";
import {apiErrorMessage, ApiErrorCode} from "@/api/apiErrors";
import {ManageApiError} from "@/api/manage";
import {countEventBroadcastAudience, sendEventBroadcast, type BroadcastAudience} from "@/api/manageBroadcasts";
import {EventBrandLogo} from "@/components/event/EventBrandLogo";
import {EmptyState} from "@/components/ui/EmptyState";
import {ConfirmDialog} from "@/components/ui/ConfirmDialog";
import {EventButton} from "@/components/ui/EventButton";
import {t} from "@/i18n/t";
import {useManager} from "../ManagerShell";
import {useDebounced} from "../notifications/useDebounced";
import {AudiencePicker} from "./AudiencePicker";
import {BroadcastMessageFields, BroadcastMessagePreview} from "./BroadcastMessageFields";
import {SaveTemplateDialog} from "./SaveTemplateDialog";
import {TemplateStart} from "./TemplateStart";
import {withTemplate, type BroadcastTemplate} from "./broadcastTemplates";
import {
    audienceReady, broadcastPayload, emailBodyFilled, composeValidation, emptyDraft, messageValidation, normalizedAudience, type BroadcastDraft,
} from "./broadcastModel";
import "./broadcasts.css";

const BASE = "/manage/broadcasts";

function sendErrorMessage(error: unknown): string {
    const code = error instanceof ManageApiError ? error.code : undefined;
    if (code === ApiErrorCode.BroadcastEmptyAudience) return t("manage.broadcasts.error.emptyAudience");
    if (code === ApiErrorCode.BroadcastInvalid) return t("manage.broadcasts.error.invalid");
    return apiErrorMessage(code, t("manage.broadcasts.error.send"));
}

// «Надіслати повідомлення»: channels, the message (the email editor of the
// event's templates and the in-app fields), the audience with a live recipient
// count, and the previews. Sending asks for confirmation first.
export function BroadcastCompose() {
    const {event, canManage} = useManager();
    const eventID = event.EventID;
    const router = useRouter();
    const queryClient = useQueryClient();
    const [draft, setDraft] = useSessionDraftState<BroadcastDraft>("broadcast-compose", emptyDraft);
    const [confirming, setConfirming] = useState(false);
    // A template chosen over existing content waits here for the replacement to be confirmed.
    const [pendingTemplate, setPendingTemplate] = useState<BroadcastTemplate | null>(null);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState("");
    // Errors show once a field is left empty or after «Надіслати» is pressed, never on an untouched form.
    const [touched, setTouched] = useState<ReadonlySet<string>>(() => new Set());
    const [attempted, setAttempted] = useState(false);
    const fieldsRef = useRef<HTMLDivElement>(null);
    const revealFirstError = useRevealFirstError(fieldsRef);
    const visible = (field: string) => attempted || touched.has(field);
    const leave = (field: string) => (event: FocusEvent<HTMLElement>) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setTouched(current => current.has(field) ? current : new Set(current).add(field));
    };
    const set = (patch: Partial<BroadcastDraft>) => setDraft(current => ({...current, ...patch}));
    const [savingTemplate, setSavingTemplate] = useState(false);

    const currentKey = JSON.stringify(normalizedAudience(draft.Audience));
    const audienceKey = useDebounced(currentKey);
    const audience = useMemo(() => JSON.parse(audienceKey) as BroadcastAudience, [audienceKey]);
    const ready = audienceReady(draft.Audience);
    const count = useQuery({
        queryKey: ["event-broadcast-count", eventID, audienceKey], queryFn: () => countEventBroadcastAudience(eventID, audience),
        enabled: ready && canManage, retry: false, refetchOnWindowFocus: false, placeholderData: previous => previous,
    });
    const settled = audienceKey === currentKey;
    const recipients = ready && settled && !count.isError ? count.data : undefined;
    const validation = composeValidation(draft);
    const canSend = canManage && !validation && recipients !== undefined && recipients > 0 && !count.isFetching;
    const audienceError = !ready ? t(draft.Audience.Kind === "teams" ? "manage.broadcasts.validation.teams" : "manage.broadcasts.validation.participants") : "";

    function applyTemplate(template: BroadcastTemplate) {
        setDraft(current => withTemplate(current, template));
    }
    function pickTemplate(template: BroadcastTemplate) {
        const filled = draft.Subject.trim() !== "" || draft.Preheader.trim() !== "" || emailBodyFilled(draft.Body) || draft.InAppTitle.trim() !== "" || draft.InAppBody.trim() !== "" || draft.InAppLink.trim() !== "";
        const replaces = (template.kind === "saved" && filled) || (template.email && (draft.Subject.trim() !== "" || draft.Preheader.trim() !== "" || emailBodyFilled(draft.Body)))
            || (template.inApp && (draft.InAppTitle.trim() !== "" || draft.InAppBody.trim() !== "" || draft.InAppLink.trim() !== ""));
        if (replaces) setPendingTemplate(template);
        else applyTemplate(template);
    }

    // «Надіслати» on an incomplete form shows every error and moves to the first one.
    function requestSend() {
        setError("");
        if (!validation) {
            if (canSend) setConfirming(true);
            return;
        }
        setAttempted(true);
        revealFirstError();
    }

    // «Зберегти як шаблон» stores the message without the audience; an incomplete message shows its errors first.
    function requestSaveTemplate() {
        if (!messageValidation(draft)) {setSavingTemplate(true); return;}
        setAttempted(true);
        revealFirstError();
    }

    async function send() {
        if (!canSend || sending) return;
        setSending(true);
        setError("");
        try {
            const broadcast = await sendEventBroadcast(eventID, broadcastPayload(draft));
            await queryClient.invalidateQueries({queryKey: ["event-manage-broadcasts", eventID]});
            setConfirming(false);
            setDraft(current => current === draft ? emptyDraft() : current);
            router.push(`${BASE}/${broadcast.ID}`);
        } catch (failure) {
            setError(sendErrorMessage(failure));
        } finally {setSending(false);}
    }

    const back = <Link className="event-template-header__back" href={BASE}><ArrowLeft size={15} aria-hidden="true" /> {t("manage.broadcasts.title")}</Link>;
    if (!canManage) return <div className="event-manage-settings">{back}<EmptyState message={t("manage.broadcasts.viewerCannotSend")} /></div>;

    const countText = !ready ? "" : count.isError ? "" : recipients !== undefined && settled ? t("manage.broadcasts.recipients", {count: recipients}) : "";
    return <div className="event-manage-settings event-template-page">
        <div className="event-template-header">
            {back}
            <div className="event-template-header__title"><h1>{t("manage.broadcasts.new")}</h1></div>
            <div className="event-template-header__actions">
                <button className="ib-btn" type="button" onClick={requestSaveTemplate}><BookmarkPlus size={15} aria-hidden="true" /> {t("manage.customTemplates.saveAs.action")}</button>
                <EventButton className="ib-btn ib-btn--primary" type="button" disabled={!validation && !canSend} onClick={requestSend}><Send size={15} aria-hidden="true" /> {t("manage.broadcasts.send")}</EventButton>
            </div>
        </div>
        <p className="event-template-page__intro">{t("manage.broadcasts.composeIntro")}</p>
        <div className="event-template-grid">
            <div className="event-template-grid__fields" ref={fieldsRef}>
                <TemplateStart event={event} onPick={pickTemplate} />
                <BroadcastMessageFields event={event} value={draft} onChange={set} fields={{visible, leave}} idPrefix="broadcast" canLoadPresets={canManage} />

                <section className="event-broadcast-section" role="group" aria-label={t("manage.broadcasts.audience.label")} aria-invalid={!!audienceError || undefined} aria-describedby={audienceError ? "broadcast-audience-error" : undefined}>
                    <AudiencePicker event={event} value={draft.Audience} onChange={Audience => set({Audience})} />
                    {audienceError && <p id="broadcast-audience-error" className="event-manage-validation" role="alert">{audienceError}</p>}
                    <div className="event-broadcast-count" role="status" aria-live="polite">
                        {ready && (count.isFetching || !settled) && <EventBrandLogo event={event} className="event-loading-logo" size={16} />}
                        {countText && <span>{countText}</span>}
                        {ready && count.isError && <span className="event-manage-validation">{t("manage.broadcasts.countError")}</span>}
                    </div>
                </section>
                {recipients === 0 && !validation && ready && <p className="event-manage-validation" role="alert">{t("manage.broadcasts.error.emptyAudience")}</p>}
            </div>
            <div className="event-template-grid__preview event-broadcast-preview">
                <BroadcastMessagePreview event={event} value={draft} />
            </div>
        </div>
        <ConfirmDialog open={pendingTemplate !== null} onCancel={() => setPendingTemplate(null)} title={t("manage.broadcasts.template.replace.title")}
            description={t("manage.broadcasts.template.replace.body", {name: pendingTemplate?.label ?? ""})} confirmLabel={t("manage.broadcasts.template.replace.action")} busyLabel={t("common.busy.applying")}
            onConfirm={() => {if (pendingTemplate) applyTemplate(pendingTemplate); setPendingTemplate(null);}} />
        <ConfirmDialog open={confirming} onCancel={() => setConfirming(false)} title={t("manage.broadcasts.confirm.title", {count: recipients ?? 0})}
            description={t("manage.broadcasts.confirm.body")} confirmLabel={t("manage.broadcasts.confirm.action")} busy={sending} busyLabel={t("common.busy.sending")} error={error || undefined} onConfirm={() => void send()} />
        <SaveTemplateDialog open={savingTemplate} eventID={eventID} message={draft} onClose={() => setSavingTemplate(false)} />
    </div>;
}
