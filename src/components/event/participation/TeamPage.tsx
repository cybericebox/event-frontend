"use client";

import {useState, type FormEvent} from "react";
import Link from "next/link";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import toast from "react-hot-toast";
import {Copy} from "lucide-react";
import {EmptyState} from "@/components/ui/EmptyState";
import {EventLoadError} from "@/components/event/EventLoadError";
import {getRegistrationWindow, type OwnTeam} from "@/api/clientAuth";
import {
    createEventTeam, disbandEventTeam, getOwnTeamMembers, getSelfTeamFields, joinEventTeam, joinLinkExpiries, kickEventTeamMember, leaveEventTeam,
    regenerateEventTeamCode, renameEventTeam, TeamRole, transferEventTeamCaptain, updateOwnTeamFields, type JoinLinkExpiry, type TeamMember,
} from "@/api/eventTeams";
import type {ParticipantAnswers} from "@/api/participantForm";
import type {PublicEventInfo} from "@/api/publicEventInfo";
import type {ParticipantEventInfo} from "@/types/participantEventInfo";
import {useGuestEvent} from "@/components/event/GuestShell";
import {useParticipantContext} from "@/components/event/ParticipantShell";
import {useStaffAccess} from "@/components/event/useStaffAccess";
import {TeamFieldsInputs} from "@/components/event/TeamFieldsInputs";
import {DialogModal} from "@/components/event/DialogModal";
import {EventBanner} from "@/components/event/EventBanner";
import {EventLoading} from "@/components/event/EventLoading";
import {missingMembers} from "@/components/event/challenges/challengeBoardModel";
import {t, tPlural} from "@/i18n/t";
import {EventButton} from "@/components/ui/EventButton";
import {EventSelect} from "@/components/ui/EventSelect";
import {ConfirmDialog} from "@/components/ui/ConfirmDialog";
import {changedEditableAnswers, forgetJoinCode, formFields, joinCodeFromSearch, joinLink, joinLinkValidity, parseJoinCode, recalledJoinCode, rememberJoinCode, rosterLine} from "./participationModel";
import {getModeratorsTeam} from "@/api/moderatorsBoard";
import {eventRoleLabel} from "@/utils/roles";
import {previewMembers, previewOwnTeam} from "./participationPreview";
import {errorText, FieldRow, FieldRows, FieldsEditor, Section, TeamConfirm, type Confirm} from "./participationParts";

function PageHeading({sub}: {sub: string}) {
    return <header className="ib-page-header"><div className="ib-page-header__top"><div className="ib-page-header__heading">
        <h1 className="ib-page-header__title">{t("participation.team.pageTitle")}</h1>
        <p className="ib-page-header__sub">{sub}</p>
    </div></div></header>;
}

// A join link is opened by a visitor who may still have to sign in or register: the code waits in the session.
function useLinkCode(): string {
    const [code] = useState(() => {
        const fromLink = typeof window === "undefined" ? "" : joinCodeFromSearch(window.location.search);
        if (fromLink) rememberJoinCode(fromLink);
        return fromLink || recalledJoinCode();
    });
    return code;
}

function NoTeam({event, rosterOpen, linkCode, preview}: {event: PublicEventInfo; rosterOpen: boolean; linkCode: string; preview: boolean}) {
    const queryClient = useQueryClient();
    const [code, setCode] = useState(linkCode);
    const [name, setName] = useState("");
    const [fields, setFields] = useState<ParticipantAnswers>({});
    const [createOpen, setCreateOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const fieldsQuery = useQuery({queryKey: ["event-team-fields", event.EventID], queryFn: () => getSelfTeamFields(), enabled: createOpen && !preview, refetchOnWindowFocus: false});
    const refresh = () => Promise.all([
        queryClient.invalidateQueries({queryKey: ["event-own-team", event.EventID]}),
        queryClient.invalidateQueries({queryKey: ["event-participant-info", event.EventID]}),
    ]);
    if (!rosterOpen) return <p className="event-part__note">{t("participation.noTeam.frozen")}</p>;
    const join = async (submit: FormEvent) => {
        submit.preventDefault();
        if (preview) { toast(t("participation.preview.noChanges")); return; }
        setBusy(true);
        setError("");
        try {
            await joinEventTeam(event.EventID, parseJoinCode(code));
            forgetJoinCode();
            await refresh();
        } catch (failure) {
            // JoinTeam: 404 = unknown link; 409 = full team, expired link or closed roster.
            setError(errorText(failure, t("participation.noTeam.joinFailed")));
        } finally { setBusy(false); }
    };
    const create = async (submit: FormEvent) => {
        submit.preventDefault();
        if (preview) { toast(t("participation.preview.noChanges")); return; }
        setBusy(true);
        setError("");
        try {
            await createEventTeam(event.EventID, name.trim(), fields);
            setCreateOpen(false);
            await refresh();
        } catch (failure) {
            setError(errorText(failure, t("participation.noTeam.createFailed")));
        } finally { setBusy(false); }
    };
    return <>
        {linkCode && <div className="event-participation__banners ib-banner-stack"><EventBanner tone="info" title={t("participation.noTeam.linkTitle")} message={t("participation.noTeam.linkMessage")} /></div>}
        <div className="event-part__choice">
            <section><h3>{t("participation.noTeam.create")}</h3><p>{t("participation.noTeam.createNote")}</p><button type="button" className="ib-btn ib-btn--primary" onClick={() => { setError(""); setCreateOpen(true); }}>{t("participation.noTeam.create")}</button></section>
            <section><h3>{t("participation.noTeam.joinTitle")}</h3><p>{t("participation.noTeam.joinNote")}</p>
                <form className="event-part__inline" onSubmit={event => void join(event)}>
                    <input className="ib-input ib-input--mono" value={code} onChange={event => setCode(event.target.value)} aria-label={t("participation.noTeam.code")} placeholder={t("participation.noTeam.code")} required autoComplete="off" disabled={busy} />
                    <button type="submit" className="ib-btn" disabled={busy || !parseJoinCode(code)}>{t("participation.noTeam.join")}</button>
                </form>
            </section>
        </div>
        {error && !createOpen && <p className="ib-cmodal__msg is-error" role="alert">{error}</p>}
        <DialogModal open={createOpen} onClose={() => { if (!busy) setCreateOpen(false); }} title={t("participation.noTeam.create")} description={t("participation.noTeam.createDescription")}>
            <form className="event-part__form" onSubmit={event => void create(event)}>
                <label className="ib-field"><span className="ib-field__label">{t("participation.team.name")}</span><input className="ib-input" value={name} onChange={event => setName(event.target.value)} required minLength={3} maxLength={64} disabled={busy} autoFocus /></label>
                {fieldsQuery.data?.Enabled && <TeamFieldsInputs form={fieldsQuery.data} answers={fields} onChange={(key, value) => setFields(current => ({...current, [key]: value}))} disabled={busy} />}
                {fieldsQuery.isError && <EventLoadError compact message={t("participation.noTeam.fieldsFailed")} error={fieldsQuery.error} onRetry={() => void fieldsQuery.refetch()} />}
                {error && <p className="ib-cmodal__msg is-error" role="alert">{error}</p>}
                <div className="event-part__actions"><EventButton type="submit" className="ib-btn ib-btn--primary" disabled={busy || (fieldsQuery.isPending && !preview)} busy={busy}>{t("participation.noTeam.createAction")}</EventButton></div>
            </form>
        </DialogModal>
    </>;
}

// «Перевипустити»: the old link stops working; the captain picks how long the new one lives.
function RegenerateLinkDialog({open, onClose, onRegenerate}: {open: boolean; onClose: () => void; onRegenerate: (expiry: JoinLinkExpiry) => Promise<void>}) {
    const [expiry, setExpiry] = useState<JoinLinkExpiry>("none");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    return <ConfirmDialog open={open} onCancel={() => { if (!busy) { setError(""); onClose(); } }} busy={busy} error={error}
        title={t("participation.team.link.regenerateTitle")} description={t("participation.team.link.regenerateText")} confirmLabel={t("participation.team.link.regenerate")}
        onConfirm={async () => {
            setBusy(true);
            setError("");
            try { await onRegenerate(expiry); onClose(); } catch (failure) { setError(failure instanceof Error ? failure.message : ""); } finally { setBusy(false); }
        }}>
        <div className="ib-field"><span className="ib-field__label">{t("participation.team.link.expiry")}</span>
            <EventSelect ariaLabel={t("participation.team.link.expiry")} value={expiry} onValueChange={value => setExpiry(value as JoinLinkExpiry)} disabled={busy}
                options={joinLinkExpiries.map(value => ({value, label: t(`participation.team.link.expiry.${value}`)}))} />
        </div>
    </ConfirmDialog>;
}

// Only the captain sees the link and shares it.
function JoinLinkRow({team, canRegenerate, onRegenerate, preview}: {team: OwnTeam; canRegenerate: boolean; onRegenerate: (expiry: JoinLinkExpiry) => Promise<void>; preview: boolean}) {
    const [regenerating, setRegenerating] = useState(false);
    const [now] = useState(() => Date.now());
    const link = joinLink(window.location.origin, team.JoinCode);
    const validity = joinLinkValidity(team.JoinCodeExpiresAt, now);
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(link);
            toast.success(t("participation.team.link.copied"));
        } catch { toast.error(t("participation.team.link.copyFailed")); }
    };
    return <FieldRow label={t("participation.team.link.label")}>
        <span className="event-part__link"><input className="ib-input ib-input--mono" readOnly value={link} aria-label={t("participation.team.link.label")} onFocus={event => event.currentTarget.select()} />
            <small className={validity.expired ? "event-part__warn" : "event-part__muted"}>{validity.text}</small></span>
        <span className="event-part__end"><button type="button" className="ib-btn ib-btn--sm" onClick={() => void copy()}><Copy aria-hidden="true" />{t("participation.team.link.copy")}</button>
            {canRegenerate && <button type="button" className="ib-btn ib-btn--sm ib-btn--ghost" onClick={() => setRegenerating(true)}>{t("participation.team.link.regenerate")}</button>}</span>
        <RegenerateLinkDialog open={regenerating} onClose={() => setRegenerating(false)} onRegenerate={async expiry => {
            if (preview) { toast(t("participation.preview.noChanges")); return; }
            await onRegenerate(expiry);
        }} />
    </FieldRow>;
}

function TeamSection({event, info, team, rosterOpen, finished, preview}: {event: PublicEventInfo; info: ParticipantEventInfo; team: OwnTeam; rosterOpen: boolean; finished: boolean; preview: boolean}) {
    const queryClient = useQueryClient();
    const members = useQuery({queryKey: ["event-team-members", event.EventID, team.ID], queryFn: () => getOwnTeamMembers(event.EventID), enabled: !preview, retry: false, refetchOnWindowFocus: false});
    const fieldsForm = useQuery({queryKey: ["event-team-fields", event.EventID], queryFn: () => getSelfTeamFields(), enabled: !preview, refetchOnWindowFocus: false});
    const [confirm, setConfirm] = useState<Confirm>(null);
    const [renaming, setRenaming] = useState(false);
    const [name, setName] = useState(team.Name);
    const [editingFields, setEditingFields] = useState(false);
    const captain = team.Role === TeamRole.Captain;
    const memberList: TeamMember[] | undefined = preview ? previewMembers() : members.data;
    const teamFieldForm = preview ? undefined : fieldsForm.data;
    const own = memberList?.find(member => member.Own);
    const refresh = () => Promise.all([
        queryClient.invalidateQueries({queryKey: ["event-own-team", event.EventID]}),
        queryClient.invalidateQueries({queryKey: ["event-team-members", event.EventID]}),
        queryClient.invalidateQueries({queryKey: ["event-participant-info", event.EventID]}),
    ]);
    // inline: a confirmation shows the failure itself, so it gets the text instead of a toast.
    const run = (action: () => Promise<void>, done: string, fallback: string, inline = false) => async () => {
        if (preview) { toast(t("participation.preview.noChanges")); return; }
        try {
            await action();
            await refresh();
            toast.success(done);
        } catch (error) {
            if (inline) throw new Error(errorText(error, fallback));
            toast.error(errorText(error, fallback));
            throw error;
        }
    };
    const rename = async (submit: FormEvent) => {
        submit.preventDefault();
        try {
            await run(() => renameEventTeam(event.EventID, team.ID, name.trim()), t("participation.team.renamed"), t("participation.team.renameFailed"))();
            setRenaming(false);
        } catch { /* toast shown */ }
    };
    const memberActions = (member: TeamMember) => captain && rosterOpen && !member.Own && !member.Pending && <>
        <button type="button" className="ib-btn ib-btn--sm ib-btn--ghost" onClick={() => setConfirm({title: t("participation.team.transferTitle"), text: t("participation.team.transferText", {name: member.DisplayName}), action: t("participation.team.transferAction"), run: run(() => transferEventTeamCaptain(event.EventID, team.ID, member.UserID), t("participation.team.transferred"), t("participation.team.transferFailed"), true)})}>{t("participation.team.makeCaptain")}</button>
        <button type="button" className="ib-btn ib-btn--sm ib-btn--ghost" onClick={() => setConfirm({title: t("participation.team.kickTitle"), text: t("participation.team.kickText", {name: member.DisplayName}), action: t("participation.team.kickAction"), danger: true, run: run(() => kickEventTeamMember(event.EventID, team.ID, member.UserID), t("participation.team.kicked"), t("participation.team.kickFailed"), true)})}>{t("participation.team.kickAction")}</button>
    </>;
    const min = team.MinTeamSize ?? info.MinTeamSize;
    const missing = missingMembers(team.MemberCount, min);
    return <Section title={t("participation.team.title")} note={captain ? (rosterOpen ? t("participation.team.captainRosterOpen") : t("participation.team.rosterFrozen")) : (rosterOpen ? t("participation.team.memberRosterOpen") : t("participation.team.rosterFrozen"))}>
        {team.Admitted === false && <div className="event-participation__banners ib-banner-stack"><EventBanner tone="warning" title={missing ? tPlural("team.notAdmitted.missing", missing) : t("team.notAdmitted.title")} message={t("participation.team.notAdmittedMessage")} /></div>}
        <dl className="event-part__rows">
            <FieldRow label={t("participation.team.nameLabel")}>{renaming
                ? <form className="event-part__inline" onSubmit={event => void rename(event)}><input className="ib-input" value={name} onChange={event => setName(event.target.value)} minLength={3} maxLength={64} required aria-label={t("participation.team.name")} autoFocus /><button type="submit" className="ib-btn ib-btn--primary">{t("common.save")}</button><button type="button" className="ib-btn" onClick={() => setRenaming(false)}>{t("common.cancel")}</button></form>
                : <><span>{team.Name}</span>{captain && rosterOpen && <span className="event-part__end"><button type="button" className="ib-btn ib-btn--sm" onClick={() => { setName(team.Name); setRenaming(true); }}>{t("participation.team.rename")}</button></span>}</>}</FieldRow>
            <FieldRow label={t("participation.team.roster")}><span>{rosterLine(team.MemberCount, team.MaxTeamSize ?? info.MaxTeamSize, min)}</span>{team.Admitted !== false && <span className="ib-tag ib-tag--ok">{t("participation.team.admitted")}</span>}</FieldRow>
            {captain && team.JoinCode && <JoinLinkRow team={team} canRegenerate={rosterOpen} preview={preview}
                onRegenerate={async expiry => { await run(() => regenerateEventTeamCode(event.EventID, team.ID, expiry), t("participation.team.link.updated"), t("participation.team.link.updateFailed"), true)(); }} />}
        </dl>
        <h3 className="event-part__subhead">{t("participation.team.members")}</h3>
        {!memberList ? (members.isError ? <EventLoadError compact message={t("participation.team.membersFailed")} error={members.error} onRetry={() => void members.refetch()} /> : <EventLoading compact label={t("participation.team.membersLoading")} />) :
            <table className="event-members"><thead><tr><th>{t("participation.team.member")}</th><th>{t("participation.team.role")}</th><th><span className="ib-sr">{t("participation.team.actions")}</span></th></tr></thead>
                <tbody>{memberList.map(member => <tr key={member.UserID} className={member.Own ? "is-own" : undefined}>
                    <td>{member.DisplayName}{member.Own && <span className="event-part__muted"> · {t("participation.team.you")}</span>}</td>
                    <td>{member.Pending ? <span className="ib-tag ib-tag--warn">{t("participation.team.pending")}</span>
                        : member.Role === TeamRole.Captain ? <span className="ib-tag ib-tag--role">{t("participation.team.captain")}</span> : <span className="event-part__muted">{t("participation.team.member")}</span>}</td>
                    <td className="is-actions">{memberActions(member)}</td>
                </tr>)}</tbody></table>}
        {teamFieldForm && formFields(teamFieldForm).length > 0 && <>
            <h3 className="event-part__subhead">{t("participation.team.fieldsTitle")}</h3>
            {editingFields
                ? <FieldsEditor form={teamFieldForm} answers={team.ExtraFields as ParticipantAnswers} onCancel={() => setEditingFields(false)} onSave={async draft => {
                    try {
                        await run(() => updateOwnTeamFields(event.EventID, team.ID, changedEditableAnswers(teamFieldForm, team.ExtraFields as ParticipantAnswers, draft)).then(() => undefined), t("participation.team.fieldsSaved"), t("participation.team.fieldsSaveFailed"))();
                        setEditingFields(false);
                    } catch { /* toast shown */ }
                }} />
                : <FieldRows form={teamFieldForm} answers={team.ExtraFields} canEdit={captain && !finished} onEdit={() => setEditingFields(true)} />}
        </>}
        {rosterOpen && own && <div className="event-part__actions">
            {captain
                ? <button type="button" className="ib-btn ib-btn--danger" onClick={() => setConfirm({title: t("participation.team.disbandTitle"), text: t("participation.team.disbandText"), action: t("participation.team.disbandAction"), danger: true, run: run(() => disbandEventTeam(event.EventID, team.ID), t("participation.team.disbanded"), t("participation.team.disbandFailed"), true)})}>{t("participation.team.disband")}</button>
                : <button type="button" className="ib-btn ib-btn--danger" onClick={() => setConfirm({title: t("participation.team.leaveTitle"), text: t("participation.team.leaveText"), action: t("participation.team.leaveAction"), danger: true, run: run(() => leaveEventTeam(event.EventID), t("participation.team.left"), t("participation.team.leaveFailed"), true)})}>{t("participation.team.leave")}</button>}
        </div>}
        <TeamConfirm confirm={confirm} onClose={() => setConfirm(null)} />
    </Section>;
}

// Organizers see the real hidden moderators team, read-only: no link, no roster actions, no results.
function ModeratorsTeamSection({members}: {members: {UserID: string; Name: string; Role: number}[]}) {
    return <Section title={t("participation.team.title")} note={t("participation.team.moderatorsNote")}>
        <dl className="event-part__rows">
            <FieldRow label={t("participation.team.nameLabel")}><span>{t("participation.team.moderatorsName")}</span></FieldRow>
            <FieldRow label={t("participation.team.roster")}><span>{members.length}</span></FieldRow>
        </dl>
        <h3 className="event-part__subhead">{t("participation.team.members")}</h3>
        <table className="event-members"><thead><tr><th>{t("participation.team.member")}</th><th>{t("participation.team.role")}</th></tr></thead>
            <tbody>{members.map(member => <tr key={member.UserID}><td>{member.Name}</td><td><span className="ib-tag ib-tag--role">{eventRoleLabel(member.Role)}</span></td></tr>)}</tbody></table>
    </Section>;
}

// «Моя команда»: the roster and, for the captain, the join link and the roster management.
export function TeamPage() {
    const access = useParticipantContext();
    const guest = useGuestEvent();
    const staff = useStaffAccess(guest?.EventID);
    const linkCode = useLinkCode();
    const event = access?.event ?? guest;
    const registration = useQuery({queryKey: ["event-registration-window", event?.EventID], queryFn: () => getRegistrationWindow(event!.EventID), enabled: !!event, retry: false, refetchOnWindowFocus: false});
    const [now] = useState(() => Date.now());
    const moderators = useQuery({queryKey: ["event-moderators-team", event?.EventID], queryFn: () => getModeratorsTeam(event!.EventID), enabled: !!event && !access && staff.staff, retry: false, refetchOnWindowFocus: false});
    if (!event) return <EventLoading label={t("participation.loading")} />;
    const participant = !!access;
    const previewing = !participant && staff.staff;
    if (!participant && !previewing) {
        if (staff.pending) return <EventLoading label={t("participation.loading")} />;
        return <div className="event-participation"><PageHeading sub={event.Name} />
            <EmptyState message={linkCode ? t("participation.team.linkRegister") : t("participation.unavailable")} action={<Link className="ib-btn ib-btn--primary" href="/join">{t("shell.join.action")}</Link>} />
        </div>;
    }
    if (event.Participation !== 1) return <div className="event-participation"><PageHeading sub={event.Name} />
        <EmptyState message={t("participation.team.individualOnly")} action={<Link className="ib-btn" href="/participation">{t("nav.participation")}</Link>} />
    </div>;
    if (registration.isPending) return <EventLoading label={t("participation.loading")} />;
    if (registration.isError) return <EventLoadError message={t("participation.team.loadFailed")} error={registration.error} onRetry={() => void registration.refetch()} />;
    const rosterOpen = registration.data.rosterOpen;
    const finished = !!event.FinishTime && Date.parse(event.FinishTime) <= now;
    if (previewing && moderators.isPending) return <EventLoading label={t("participation.loading")} />;
    const realModerators = previewing && moderators.data ? moderators.data : null;
    const info = access?.participantInfo;
    const team = previewing ? previewOwnTeam() : access?.ownTeam ?? null;
    return <div className="event-participation">
        <PageHeading sub={finished ? t("participation.sub.finished", {name: event.Name}) : event.Name} />
        {realModerators && <div className="event-participation__banners ib-banner-stack"><EventBanner tone="info" title={t("challenges.moderators.bannerTitle")} message={t("challenges.moderators.bannerMessage")} /></div>}
        {previewing && !realModerators && <div className="event-participation__banners ib-banner-stack"><EventBanner tone="info" title={t("participation.preview.title")} message={t("participation.preview.message")} /></div>}
        {realModerators ? <ModeratorsTeamSection members={realModerators.Members} /> : team
            ? <TeamSection event={event} info={info ?? ({MinTeamSize: 2, MaxTeamSize: 4} as ParticipantEventInfo)} team={team} rosterOpen={rosterOpen} finished={finished} preview={previewing} />
            : <Section title={t("participation.team.title")} note={t("participation.noTeam.sectionNote")}><NoTeam event={event} rosterOpen={rosterOpen} linkCode={linkCode} preview={previewing} /></Section>}
    </div>;
}
