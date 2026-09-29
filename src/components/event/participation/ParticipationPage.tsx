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
import {changedEditableAnswers, defaultParticipationTab, formFields, participationTabFromParam, participationTabHref, type ParticipationTab} from "./participationModel";
import {previewParticipantInfo} from "./participationPreview";
import {errorText, FieldRow, FieldRows, FieldsEditor, Section, useLinkCode} from "./participationParts";
import {TeamTab} from "./TeamPage";
import {getOwnTeamMembers, TeamRole} from "@/api/eventTeams";

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
            const changed = changedEditableAnswers(answers.data.Form, answers.data.Answers, draft, answers.data.Missing ?? []);
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
                ? <FieldsEditor form={answers.data.Form} answers={answers.data.Answers} fillable={answers.data.Missing ?? []} onCancel={() => setEditing(false)} onSave={save} />
                : <FieldRows form={answers.data.Form} answers={answers.data.Answers} canEdit={answers.data.Editable && !finished} missing={answers.data.Missing ?? []} onEdit={() => setEditing(true)} />}
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

function ProfileTab({event, info, finished, preview}: {event: PublicEventInfo; info: ParticipantEventInfo; finished: boolean; preview: boolean}) {
    return <>
        {preview && <div className="event-participation__banners ib-banner-stack"><EventBanner tone="info" title={t("participation.preview.title")} message={t("participation.preview.message")} /></div>}
        <SelfSection event={event} info={info} finished={finished} preview={preview} />
        {!preview && <VpnSection />}
    </>;
}

// «Моя участь»: the profile and, in team mode, the team as two tabs (?tab=team is deep-linkable).
export function ParticipationPage() {
    const access = useParticipantContext();
    const guest = useGuestEvent();
    const staff = useStaffAccess(guest?.EventID);
    const linkCode = useLinkCode();
    const [now] = useState(() => Date.now());
    const [selected, setSelected] = useState<string | null>(() => typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("tab"));
    const event = access?.event ?? guest;
    const teamMode = event?.Participation === 1;
    const info = access?.participantInfo;
    const team = access?.ownTeam ?? null;
    const previewing = !access && staff.staff;
    const explicit = participationTabFromParam(selected, !!teamMode);
    const captain = !!team && team.Role === TeamRole.Captain;
    // The captain's default tab depends on pending invitations, so it waits for the roster.
    const members = useQuery({queryKey: ["event-team-members", event?.EventID, team?.ID], queryFn: () => getOwnTeamMembers(event!.EventID), enabled: !!event && !!team && captain && !explicit, retry: false, refetchOnWindowFocus: false});
    const answers = useQuery({queryKey: ["event-own-answers", event?.EventID], queryFn: () => getOwnParticipantAnswers(), enabled: !!access, retry: false, refetchOnWindowFocus: false});
    if (!event) return <EventLoading label={t("participation.loading")} />;
    if (!access && !previewing) {
        if (staff.pending) return <EventLoading label={t("participation.loading")} />;
        return <div className="event-participation">
            <Heading />
            <EmptyState message={linkCode ? t("participation.team.linkRegister") : t("participation.unavailable")} action={<Link className="ib-btn ib-btn--primary" href="/join">{linkCode ? t("shell.join.action") : t("participation.noTeam.join")}</Link>} />
        </div>;
    }
    if (access && !info) return <EventLoading label={t("participation.loading")} />;
    if (!explicit && captain && members.isPending) return <EventLoading label={t("participation.loading")} />;
    const started = Date.parse(event.StartTime) <= now;
    const finished = !!event.FinishTime && Date.parse(event.FinishTime) <= now;
    const tab = explicit ?? defaultParticipationTab({
        teamMode: !!teamMode, captain, memberCount: team?.MemberCount ?? 0, minSize: team?.MinTeamSize ?? info?.MinTeamSize ?? 0,
        pending: members.data?.filter(member => member.Pending).length ?? 0,
    });
    const missing: Record<ParticipationTab, boolean> = {profile: (answers.data?.Missing ?? []).length > 0, team: (team?.MissingFields ?? []).length > 0};
    const tabs: {value: ParticipationTab; label: string}[] = [{value: "profile", label: t("participation.tab.profile")}, ...(teamMode ? [{value: "team" as const, label: t("participation.tab.team")}] : [])];
    const change = (value: ParticipationTab) => {
        setSelected(value);
        window.history.replaceState(null, "", participationTabHref(value));
    };
    return <div className="event-participation">
        <Heading sub={finished ? t("participation.sub.finished", {name: event.Name}) : started ? t("participation.sub.running", {name: event.Name}) : event.Name} />
        {teamMode && <div className="event-manage-participants__filters event-participation__tabs" role="tablist" aria-label={t("participation.tabs")}>{tabs.map(option =>
            <button key={option.value} className="event-manage-participants__filter" type="button" role="tab" aria-selected={tab === option.value} onClick={() => change(option.value)}>
                {option.label}{missing[option.value] && <span className="ib-tag ib-tag--warn event-part__missing">{t("participation.missing.badge")}</span>}
            </button>)}</div>}
        <div role={teamMode ? "tabpanel" : undefined}>
            {tab === "team" ? <TeamTab /> : <ProfileTab event={event} info={info ?? previewParticipantInfo(event.EventID)} finished={finished} preview={previewing} />}
        </div>
    </div>;
}
