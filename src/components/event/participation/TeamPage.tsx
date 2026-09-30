"use client";

import {useState, type FormEvent} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import toast from "react-hot-toast";
import type {OwnTeam, Participation} from "@/api/clientAuth";
import {
    disbandEventTeam, formEventTeam, getOwnTeamMembers, getSelfTeamFields, kickEventTeamMember, leaveEventTeam, regenerateEventTeamCode, renameEventTeam,
    TeamRole, transferEventTeamCaptain, updateOwnTeamFields, type JoinLinkExpiry, type TeamMember,
} from "@/api/eventTeams";
import type {ParticipantAnswers} from "@/api/participantForm";
import type {PublicEventInfo} from "@/api/publicEventInfo";
import type {ParticipantEventInfo} from "@/types/participantEventInfo";
import {EventLoadError} from "@/components/event/EventLoadError";
import {EventLoading} from "@/components/event/EventLoading";
import {reasonText, useParticipation} from "./participationRules";
import {useGuestEvent} from "@/components/event/GuestShell";
import {useParticipantContext} from "@/components/event/ParticipantShell";
import {EmptyState} from "@/components/ui/EmptyState";
import type {ParticipationStats} from "@/api/participationStats";
import {useStaffAccess} from "@/components/event/useStaffAccess";
import {EventBanner} from "@/components/event/EventBanner";
import {missingMembers} from "@/components/event/challenges/challengeBoardModel";
import {eventRoleLabel} from "@/utils/roles";
import {EventButton} from "@/components/ui/EventButton";
import {t, tPlural} from "@/i18n/t";
import {formatDateTime} from "@/utils/dateTime";
import {AnswersCard} from "./AnswersCard";
import {NoTeam} from "./NoTeam";
import {InviteCard} from "./TeamInvite";
import {MembersCard} from "./TeamMembers";
import {Card, CategoryChartCard, PointsChartCard, RatioBar, SolvesTable, StatTiles, statTiles, formatNumber, type BlockState} from "./participationBlocks";
import {changedEditableAnswers, rosterLine} from "./participationModel";
import {errorText, TeamConfirm, useLinkCode, type Confirm} from "./participationParts";
import {chartWindow, cumulativePoints, ownSolves, placeText, solveEntries, timelineEntries} from "./participationStatsModel";
import {useEventAccent} from "./useEventAccent";
import {useParticipationStats} from "./useParticipationStats";

function TeamHeader({info, team, rosterOpen, captain, captainName, stats, preview, onRename}: {
    info: ParticipantEventInfo | null; team: OwnTeam; rosterOpen: boolean; captain: boolean; captainName: string;
    stats: {rank: number; points: number} | null; preview: boolean; onRename: (name: string) => Promise<void>;
}) {
    const [renaming, setRenaming] = useState(false);
    const [name, setName] = useState(team.Name);
    const [busy, setBusy] = useState(false);
    const min = team.MinTeamSize ?? info?.MinTeamSize;
    const max = team.MaxTeamSize ?? info?.MaxTeamSize;
    const missing = missingMembers(team.MemberCount, min);
    const admitted = team.Admitted !== false;
    const rename = async (submit: FormEvent) => {
        submit.preventDefault();
        setBusy(true);
        try { await onRename(name.trim()); setRenaming(false); } catch { /* toast shown */ } finally { setBusy(false); }
    };
    return <>
        {!admitted && <div className="event-participation__banners ib-banner-stack"><EventBanner tone="warning" title={missing ? tPlural("team.notAdmitted.missing", missing) : t("team.notAdmitted.title")} message={t("participation.team.notAdmittedMessage")} /></div>}
        <section className="event-pp-card event-pp-hero" aria-label={t("participation.team.title")}>
            <div className="event-pp-hero__who">
                {renaming
                    ? <form className="event-pp-rename" onSubmit={submit => void rename(submit)}>
                        <input className="ib-input" value={name} onChange={submit => setName(submit.target.value)} minLength={3} maxLength={64} required aria-label={t("participation.team.name")} autoFocus disabled={busy} />
                        <EventButton type="submit" className="ib-btn ib-btn--primary" busy={busy}>{t("common.save")}</EventButton>
                        <button type="button" className="ib-btn" disabled={busy} onClick={() => setRenaming(false)}>{t("common.cancel")}</button>
                    </form>
                    : <div className="event-pp-rename"><h2 className="event-pp-hero__name">{team.Name}</h2>
                        {captain && rosterOpen && <button type="button" className="ib-btn ib-btn--sm" onClick={() => { setName(team.Name); setRenaming(true); }}>{t("participation.team.rename")}</button>}</div>}
                <div className="event-pp-hero__tags">
                    {!preview && (admitted ? <span className="ib-tag ib-tag--ok">{t("participation.team.admitted")}</span> : <span className="ib-tag ib-tag--warn">{t("participation.team.incomplete")}</span>)}
                    <span className="event-pp-hero__sub">{t("participation.team.roster")}: {rosterLine(team.MemberCount, max, min)}</span>
                </div>
                {captainName && <span className="event-pp-hero__sub">{t("participation.team.captainLine", {name: captainName})}</span>}
            </div>
            <dl className="event-pp-hero__score">
                {!preview && <div><dt>{t("participation.stats.teamPlace")}</dt><dd>{stats ? placeText(stats.rank) : "—"}</dd></div>}
                <div><dt>{t("participation.stats.teamPoints")}</dt><dd>{stats ? formatNumber(stats.points) : "—"}</dd></div>
            </dl>
        </section>
    </>;
}

// Organizer preview: the moderators team as the server reports it (roster, stats, solves); read-only.
export function moderatorsRoster(stats: ParticipationStats): TeamMember[] {
    return stats.Team.Members.map(item => ({UserID: item.UserID, DisplayName: item.Name, Role: TeamRole.Member, Own: item.UserID === stats.Me.UserID, Pending: false}));
}

export function moderatorsTeam(stats: ParticipationStats): OwnTeam {
    return {
        ID: stats.Team.TeamID, Name: t("participation.team.moderatorsName"), MemberCount: stats.Team.Members.length, ExtraFields: {},
        JoinCode: "", JoinCodeExpiresAt: null, Role: TeamRole.Member, Admitted: true,
    };
}

function TeamSection({event, info, team, participation, rosterOpen, finished, preview, now}: {
    event: PublicEventInfo; info: ParticipantEventInfo | null; team: OwnTeam; participation: Participation | null; rosterOpen: boolean; finished: boolean; preview: boolean; now: number;
}) {
    const queryClient = useQueryClient();
    const accent = useEventAccent();
    const members = useQuery({queryKey: ["event-team-members", event.EventID, team.ID], queryFn: () => getOwnTeamMembers(event.EventID), enabled: !preview, retry: false, refetchOnWindowFocus: false});
    const fieldsForm = useQuery({queryKey: ["event-team-fields", event.EventID], queryFn: () => getSelfTeamFields(), enabled: !preview, refetchOnWindowFocus: false});
    const stats = useParticipationStats(event.EventID, {preview, enabled: true});
    const [confirm, setConfirm] = useState<Confirm>(null);
    const captain = team.Role === TeamRole.Captain;
    // Every action follows its own server rule; a closed one says why.
    const manage = participation?.ManageTeam?.Allowed ?? rosterOpen;
    const leave = participation?.LeaveTeam?.Allowed ?? rosterOpen;
    // A formed team keeps its people: it cannot be disbanded, and leaving or being kicked is leaving the event.
    const remove = participation?.RemoveMember?.Allowed ?? rosterOpen;
    const disband = participation?.DisbandTeam?.Allowed ?? rosterOpen;
    const formed = !!team.Formed || !!participation?.TeamFormed;
    const formCap = participation?.FormTeam;
    const manageReason = reasonText(participation?.ManageTeam?.Reason ?? "");
    const disbandReason = reasonText(participation?.DisbandTeam?.Reason ?? "");
    const leaveReason = reasonText(participation?.LeaveTeam?.Reason ?? "");
    const roster: TeamMember[] | undefined = preview ? (stats.stats ? moderatorsRoster(stats.stats) : undefined) : members.data;
    // Roles are reported as owner / other; only the owner is named.
    const roleLabels = preview && stats.stats ? new Map(stats.stats.Team.Members.filter(item => item.Role === 0).map(item => [item.UserID, eventRoleLabel(0)])) : undefined;
    const teamFieldForm = preview ? undefined : fieldsForm.data;
    const own = !preview && roster?.find(member => member.Own);
    const captainName = roster?.find(member => member.Role === TeamRole.Captain)?.DisplayName ?? "";
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
    const memberActions = (member: TeamMember) => !preview && captain && manage && !member.Own && !member.Pending && <>
        <button type="button" className="ib-btn ib-btn--sm ib-btn--ghost" onClick={() => setConfirm({title: t("participation.team.transferTitle"), text: t("participation.team.transferText", {name: member.DisplayName}), action: t("participation.team.transferAction"), run: run(() => transferEventTeamCaptain(event.EventID, team.ID, member.UserID), t("participation.team.transferred"), t("participation.team.transferFailed"), true)})}>{t("participation.team.makeCaptain")}</button>
        {remove && <button type="button" className="ib-btn ib-btn--sm ib-btn--ghost" onClick={() => setConfirm({title: t("participation.team.kickTitle"), text: t("participation.team.kickText", {name: member.DisplayName}), action: t("participation.team.kickAction"), danger: true, run: run(() => kickEventTeamMember(event.EventID, team.ID, member.UserID), t("participation.team.kicked"), t("participation.team.kickFailed"), true)})}>{t("participation.team.kickAction")}</button>}
    </>;
    const min = team.MinTeamSize ?? info?.MinTeamSize;
    const max = team.MaxTeamSize ?? info?.MaxTeamSize;
    const data = stats.stats;
    const solves = data?.Team.Solves ?? [];
    const teamState: BlockState = !data ? (stats.state as BlockState) : solves.length === 0 ? "empty" : "ready";
    const teamSeries = data ? cumulativePoints(timelineEntries(data.Timeline)) : [];
    const mineSeries = data ? cumulativePoints(solveEntries(ownSolves(solves, data.Me.UserID))) : [];
    const lastAt = teamSeries.length ? teamSeries[teamSeries.length - 1][0] : null;
    const window = chartWindow(event.StartTime, event.FinishTime, now, lastAt);
    const tiles = statTiles({
        solves: data?.Solved ?? 0, points: data?.Points ?? 0, firstBloods: data?.Team.FirstBloods ?? 0, hints: data?.Team.Hints ?? 0,
        attempts: data?.Team.Attempts ?? 0, correct: data?.Team.CorrectAttempts ?? 0, scope: "team",
    }).map(tile => data ? tile : {...tile, value: "—", note: undefined});
    return <div className="event-pp">
        <TeamHeader info={info} team={team} rosterOpen={manage} captain={captain} captainName={captainName} stats={data ? {rank: data.Rank, points: data.Points} : null} preview={preview}
            onRename={name => run(() => renameEventTeam(event.EventID, team.ID, name), t("participation.team.renamed"), t("participation.team.renameFailed"))()} />
        <StatTiles label={t("participation.stats.teamTitle")} tiles={tiles} />
        <MembersCard event={event} roster={roster} error={members.error} onRetry={() => void members.refetch()} stats={data?.Team.Members ?? []} actions={memberActions} rosterLine={rosterLine(team.MemberCount, max, min)} roleLabels={roleLabels} />
        {!preview && <FormationCard team={team} captain={captain} formed={formed} form={formCap}
            onForm={() => setConfirm({title: t("participation.team.formTitle"), text: t("participation.team.formText"), action: t("participation.team.formAction"), run: run(() => formEventTeam(event.EventID), t("participation.team.formed"), t("participation.team.formFailed"), true)})} />}
        {!preview && <InviteCard team={team} captain={captain} captainName={captainName} participation={participation} rosterOpen={rosterOpen} canManage={manage} preview={false} now={now}
            onRegenerate={async (expiry: JoinLinkExpiry) => { await run(() => regenerateEventTeamCode(event.EventID, team.ID, expiry), t("participation.team.link.updated"), t("participation.team.link.updateFailed"), true)(); }} />}
        <div className="event-pp-charts">
            <PointsChartCard event={event} title={t("participation.chart.points.teamTitle")} state={teamState} error={stats.error} onRetry={stats.retry} window={window}
                series={[{name: t("participation.chart.points.team"), points: teamSeries, color: accent}, ...(mineSeries.length ? [{name: t("participation.chart.points.mine"), points: mineSeries, color: "#94a3b8", dashed: true}] : [])]} />
            <CategoryChartCard event={event} state={teamState} solves={solves} color={accent} error={stats.error} onRetry={stats.retry} />
        </div>
        <Card title={t("participation.ratio.title")} note={t("participation.ratio.note")}>
            {data ? <RatioBar correct={data.Team.CorrectAttempts} attempts={data.Team.Attempts} /> : <RatioBar correct={0} attempts={0} />}
        </Card>
        <SolvesTable event={event} state={teamState} solves={solves} now={now} showSolver error={stats.error} onRetry={stats.retry} title={t("participation.solves.teamTitle")} />
        {teamFieldForm?.Enabled && <AnswersCard scope="team" title={t("participation.team.fieldsTitle")} note={t("participation.team.fieldsNote")} form={teamFieldForm} answers={team.ExtraFields as ParticipantAnswers}
            missing={team.MissingFields ?? []} canEdit={captain && (participation?.EditAnswers?.Allowed ?? !finished)} whyReadOnly={finished ? t("participation.form.finished") : t("participation.team.fieldsCaptainOnly")}
            onSave={async draft => {
                await run(() => updateOwnTeamFields(event.EventID, team.ID, changedEditableAnswers(teamFieldForm, team.ExtraFields as ParticipantAnswers, draft, team.MissingFields ?? [])).then(() => undefined), t("participation.team.fieldsSaved"), t("participation.team.fieldsSaveFailed"), true)();
            }} />}
        {own && <section className="event-pp-card event-pp-danger" aria-label={captain ? t("participation.team.disband") : t("participation.team.leave")}>
            <p>{captain ? (disband ? t("participation.team.disbandNote") : (manage ? disbandReason : manageReason) || t("participation.team.disbandNote")) : formed ? t("participation.team.leaveEventNote") : (leave ? t("participation.team.leaveNote") : leaveReason || t("participation.team.leaveNote"))}</p>
            {captain && disband && <button type="button" className="ib-btn ib-btn--danger" onClick={() => setConfirm({title: t("participation.team.disbandTitle"), text: t("participation.team.disbandText"), action: t("participation.team.disbandAction"), danger: true, run: run(() => disbandEventTeam(event.EventID, team.ID), t("participation.team.disbanded"), t("participation.team.disbandFailed"), true)})}>{t("participation.team.disband")}</button>}
            {!captain && leave && <button type="button" className="ib-btn ib-btn--danger" onClick={() => setConfirm({title: t(formed ? "participation.team.leaveEventTitle" : "participation.team.leaveTitle"), text: t(formed ? "participation.team.leaveEventText" : "participation.team.leaveText"), action: t("participation.team.leaveAction"), danger: true, run: run(() => leaveEventTeam(event.EventID), t("participation.team.left"), t("participation.team.leaveFailed"), true)})}>{t(formed ? "participation.team.leaveEvent" : "participation.team.leave")}</button>}
        </section>}
        <TeamConfirm confirm={confirm} onClose={() => setConfirm(null)} />
    </div>;
}

// Team formation: the captain confirms the roster (it closes for good and the tasks open); the others see where it stands.
// With no late join the start forms every team, so there is nothing to confirm and only the status shows.
export function FormationCard({team, captain, formed, form, onForm}: {team: OwnTeam; captain: boolean; formed: boolean; form: Participation["FormTeam"] | undefined; onForm: () => void}) {
    if (formed) {
        return <section className="event-pp-card event-pp-danger" aria-label={t("participation.team.formTitle")}>
            <p>{team.FormedAt ? t("participation.team.statusFormed", {time: formatDateTime(team.FormedAt)}) : t("participation.team.statusFormedAtStart")}</p>
        </section>;
    }
    const reason = form && !form.Allowed ? reasonText(form.Reason) : "";
    return <section className="event-pp-card event-pp-danger" aria-label={t("participation.team.formTitle")}>
        <p>{captain ? reason || t("participation.team.formNote") : t("participation.team.statusOpen")}</p>
        {captain && form?.Allowed && <button type="button" className="ib-btn ib-btn--primary" onClick={onForm}>{t("participation.team.form")}</button>}
    </section>;
}

// The «Команда» tab of «Моя участь»: the roster, the team's results and, for the captain, the join link and the roster management.
export function TeamTab() {
    const access = useParticipantContext();
    const guest = useGuestEvent();
    const staff = useStaffAccess(guest?.EventID);
    const linkCode = useLinkCode();
    const event = access?.event ?? guest;
    const registration = useParticipation(event?.EventID, !!event);
    const [now] = useState(() => Date.now());
    const previewing = !access && staff.staff;
    const previewStats = useParticipationStats(event?.EventID, {preview: previewing, enabled: previewing});
    if (!event) return <EventLoading label={t("participation.loading")} />;
    if (registration.isPending) return <EventLoading event={event} label={t("participation.loading")} />;
    if (registration.isError) return <EventLoadError message={t("participation.team.loadFailed")} error={registration.error} onRetry={() => void registration.refetch()} />;
    const participation = registration.data ?? null;
    const rosterOpen = participation?.RosterOpen ?? false;
    const closedReason = reasonText(participation?.RosterReason ?? "");
    const finished = !!event.FinishTime && Date.parse(event.FinishTime) <= now;
    if (previewing) {
        if (previewStats.unavailable) return <EmptyState message={t("participation.preview.noModerators")} />;
        if (previewStats.notMember) return <EmptyState message={t("participation.preview.notMember")} />;
        if (previewStats.state === "loading") return <EventLoading event={event} label={t("participation.loading")} />;
        if (!previewStats.stats) return <EventLoadError message={t("participation.team.loadFailed")} error={previewStats.error} onRetry={previewStats.retry} />;
    }
    const info = access?.participantInfo ?? null;
    const team = previewing ? (previewStats.stats ? moderatorsTeam(previewStats.stats) : null) : access?.ownTeam ?? null;
    return <>
        {previewing && <div className="event-participation__banners ib-banner-stack"><EventBanner tone="info" title={t("challenges.moderators.bannerTitle")} message={t("challenges.moderators.bannerMessage")} /></div>}
        {team
            ? <TeamSection event={event} info={info} team={team} participation={participation} rosterOpen={rosterOpen} finished={finished} preview={previewing} now={now} />
            : <div className="event-pp"><p className="event-part__note">{t("participation.noTeam.sectionNote")}</p><NoTeam event={event} rosterOpen={rosterOpen} closedReason={closedReason} createReason={participation && participation.CreateTeam && !participation.CreateTeam.Allowed ? reasonText(participation.CreateTeam.Reason) : ""} joinReason={participation && participation.JoinTeam && !participation.JoinTeam.Allowed ? reasonText(participation.JoinTeam.Reason) : ""} linkCode={linkCode} preview={previewing} /></div>}
    </>;
}
