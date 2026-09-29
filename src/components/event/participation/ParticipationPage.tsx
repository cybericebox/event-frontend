"use client";

import {useState} from "react";
import Link from "next/link";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import toast from "react-hot-toast";
import {EmptyState} from "@/components/ui/EmptyState";
import {EventLoadError} from "@/components/event/EventLoadError";
import {getOwnParticipantAnswers, putOwnParticipantAnswers, putSelfPseudonym, type ParticipantAnswers} from "@/api/participantForm";
import type {PublicEventInfo} from "@/api/publicEventInfo";
import type {ParticipantEventInfo} from "@/types/participantEventInfo";
import {useGuestEvent} from "@/components/event/GuestShell";
import {useParticipantContext} from "@/components/event/ParticipantShell";
import {useStaffAccess} from "@/components/event/useStaffAccess";
import {EventBanner} from "@/components/event/EventBanner";
import {EventLoading} from "@/components/event/EventLoading";
import {StandStatusIcon, standStatusText, useEventVpn} from "@/components/event/vpn/EventVpn";
import {t} from "@/i18n/t";
import {changedEditableAnswers, formFields} from "./participationModel";
import {previewParticipantInfo} from "./participationPreview";
import {errorText, FieldRow, FieldRows, FieldsEditor, Section} from "./participationParts";

function PseudonymRow({info, eventID}: {info: ParticipantEventInfo; eventID: string}) {
    const queryClient = useQueryClient();
    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState(info.Pseudonym ?? "");
    const [busy, setBusy] = useState(false);
    const save = async (next: string | null) => {
        setBusy(true);
        try {
            await putSelfPseudonym(next);
            await queryClient.invalidateQueries({queryKey: ["event-participant-info", eventID]});
            setEditing(false);
            toast.success(next ? t("participation.pseudonym.saved") : t("participation.pseudonym.removed"));
        } catch (error) {
            toast.error(errorText(error, t("participation.pseudonym.saveFailed")));
        } finally { setBusy(false); }
    };
    if (editing) return <FieldRow label={t("participation.pseudonym.label")}><form className="event-part__inline" onSubmit={event => { event.preventDefault(); void save(value.trim() || null); }}>
        <input className="ib-input" value={value} onChange={event => setValue(event.target.value)} maxLength={32} minLength={2} aria-label={t("participation.pseudonym.label")} disabled={busy} autoFocus />
        <button type="submit" className="ib-btn ib-btn--primary" disabled={busy}>{t("common.save")}</button>
        <button type="button" className="ib-btn" disabled={busy} onClick={() => setEditing(false)}>{t("common.cancel")}</button>
    </form></FieldRow>;
    return <FieldRow label={t("participation.pseudonym.label")}>
        <span className={info.Pseudonym ? undefined : "event-part__muted"}>{info.Pseudonym || t("participation.pseudonym.notSet")}</span>
        <span className="event-part__end">{info.PseudonymEditable
            ? <><button type="button" className="ib-btn ib-btn--sm" onClick={() => { setValue(info.Pseudonym ?? ""); setEditing(true); }}>{info.Pseudonym ? t("participation.pseudonym.change") : t("common.add")}</button>
                {info.Pseudonym && <button type="button" className="ib-btn ib-btn--sm ib-btn--ghost" disabled={busy} onClick={() => void save(null)}>{t("participation.pseudonym.remove")}</button>}</>
            : <span className="event-part__muted">{t("participation.pseudonym.locked")}</span>}</span>
    </FieldRow>;
}

function SelfSection({event, info, finished, preview}: {event: PublicEventInfo; info: ParticipantEventInfo; finished: boolean; preview: boolean}) {
    const queryClient = useQueryClient();
    const [editing, setEditing] = useState(false);
    const answers = useQuery({queryKey: ["event-own-answers", event.EventID], queryFn: () => getOwnParticipantAnswers(), enabled: !preview, retry: false, refetchOnWindowFocus: false});
    const save = async (draft: ParticipantAnswers) => {
        if (!answers.data) return;
        try {
            const changed = changedEditableAnswers(answers.data.Form, answers.data.Answers, draft);
            if (Object.keys(changed).length) queryClient.setQueryData(["event-own-answers", event.EventID], await putOwnParticipantAnswers(event.EventID, changed));
            setEditing(false);
            toast.success(t("participation.fields.saved"));
        } catch (error) {
            toast.error(errorText(error, t("participation.fields.saveFailed")));
        }
    };
    return <Section title={t("participation.self.title")} note={t("participation.self.note")}>
        <dl className="event-part__rows">
            <FieldRow label={t("participation.self.name")}>{info.RealName || "—"}</FieldRow>
            {info.AllowPseudonyms && <FieldRow label={t("participation.self.shownAs")}>{info.DisplayName || info.RealName || "—"}</FieldRow>}
            {info.AllowPseudonyms && !preview && <PseudonymRow info={info} eventID={event.EventID} />}
            <FieldRow label={t("participation.self.status")}>{t("participation.self.confirmed")}</FieldRow>
        </dl>
        {answers.data && formFields(answers.data.Form).length > 0 && <>
            <h3 className="event-part__subhead">{t("participation.fields.title")}</h3>
            {editing
                ? <FieldsEditor form={answers.data.Form} answers={answers.data.Answers} onCancel={() => setEditing(false)} onSave={save} />
                : <FieldRows form={answers.data.Form} answers={answers.data.Answers} canEdit={answers.data.Editable && !finished} onEdit={() => setEditing(true)} />}
        </>}
        {answers.isError && <EventLoadError compact message={t("participation.fields.loadFailed")} error={answers.error} onRetry={() => void answers.refetch()} />}
    </Section>;
}

function VpnSection() {
    const vpn = useEventVpn();
    if (!vpn.available) return null;
    const text = vpn.status ? standStatusText(vpn.status) : null;
    return <Section title={t("participation.vpn.title")} note={t("participation.vpn.note")}>
        <div className={`event-vpn-stand is-${vpn.status ?? "unknown"}`} role="status"><StandStatusIcon status={vpn.status} /><div><b>{text?.title ?? t("vpn.modal.checkingStand")}</b>{text && <span>{text.note}</span>}</div></div>
        <div className="event-part__actions"><button type="button" className="ib-btn ib-btn--primary" onClick={vpn.openVpn}>{t("participation.vpn.setup")}</button></div>
    </Section>;
}

function Heading({sub}: {sub?: string}) {
    return <header className="ib-page-header"><div className="ib-page-header__top"><div className="ib-page-header__heading">
        <h1 className="ib-page-header__title">{t("participation.title")}</h1>
        {sub && <p className="ib-page-header__sub">{sub}</p>}
    </div></div></header>;
}

// «Мій профіль учасника»: who the participant is, their answers and the VPN. The team has its own page.
export function ParticipationPage() {
    const access = useParticipantContext();
    const guest = useGuestEvent();
    const staff = useStaffAccess(guest?.EventID);
    const [now] = useState(() => Date.now());
    if (!access) {
        // Organizers open the page as a participant sees it, filled with sample data.
        if (guest && staff.staff) return <div className="event-participation">
            <Heading sub={guest.Name} />
            <div className="event-participation__banners ib-banner-stack"><EventBanner tone="info" title={t("participation.preview.title")} message={t("participation.preview.message")} /></div>
            <SelfSection event={guest} info={previewParticipantInfo(guest.EventID)} finished={false} preview />
        </div>;
        if (staff.pending) return <EventLoading label={t("participation.loading")} />;
        return <div className="event-participation">
            <Heading />
            <EmptyState message={t("participation.unavailable")} action={<Link className="ib-btn ib-btn--primary" href="/join">{t("participation.noTeam.join")}</Link>} />
        </div>;
    }
    const {event, participantInfo: info} = access;
    if (!info) return <EventLoading label={t("participation.loading")} />;
    const started = Date.parse(event.StartTime) <= now;
    const finished = !!event.FinishTime && Date.parse(event.FinishTime) <= now;
    return <div className="event-participation">
        <Heading sub={finished ? t("participation.sub.finished", {name: event.Name}) : started ? t("participation.sub.running", {name: event.Name}) : event.Name} />
        <SelfSection event={event} info={info} finished={finished} preview={false} />
        <VpnSection />
    </div>;
}
