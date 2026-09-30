"use client";

import {useState} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import toast from "react-hot-toast";
import {Lock} from "lucide-react";
import {getOwnParticipantAnswers, putOwnParticipantAnswers, putSelfPseudonym, type ParticipantAnswers} from "@/api/participantForm";
import type {PublicEventInfo} from "@/api/publicEventInfo";
import type {OwnTeam} from "@/api/clientAuth";
import type {ParticipantEventInfo} from "@/types/participantEventInfo";
import {EventBanner} from "@/components/event/EventBanner";
import {EventLoadError} from "@/components/event/EventLoadError";
import {EventLoading} from "@/components/event/EventLoading";
import {StandStatusIcon, standStatusText, useEventVpn} from "@/components/event/vpn/EventVpn";
import {EventButton} from "@/components/ui/EventButton";
import {EmptyState} from "@/components/ui/EmptyState";
import {EventTooltip} from "@/components/ui/EventTooltip";
import {eventRoleLabel} from "@/utils/roles";
import {t} from "@/i18n/t";
import {AnswersCard} from "./AnswersCard";
import {CategoryChartCard, Card, PointsChartCard, SolvesTable, StatTiles, statTiles, formatNumber, type BlockState} from "./participationBlocks";
import {changedEditableAnswers} from "./participationModel";
import {errorText} from "./participationParts";
import {chartWindow, cumulativePoints, ownSolves, placeText, shortTime, solveEntries, timelineEntries} from "./participationStatsModel";
import {useEventAccent} from "./useEventAccent";
import {useParticipationStats} from "./useParticipationStats";

function PseudonymEditor({info, eventID}: {info: ParticipantEventInfo; eventID: string}) {
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
    if (editing) return <form className="event-pp-rename" onSubmit={event => { event.preventDefault(); void save(value.trim() || null); }}>
        <input className="ib-input" value={value} onChange={event => setValue(event.target.value)} maxLength={32} minLength={2} aria-label={t("participation.pseudonym.label")} disabled={busy} autoFocus />
        <EventButton type="submit" className="ib-btn ib-btn--primary ib-btn--sm" busy={busy}>{t("common.save")}</EventButton>
        <button type="button" className="ib-btn ib-btn--sm" disabled={busy} onClick={() => setEditing(false)}>{t("common.cancel")}</button>
    </form>;
    return <div className="event-pp-rename">
        <span className="event-pp-hero__sub">{t("participation.pseudonym.label")}: {info.Pseudonym || t("participation.pseudonym.notSet")}</span>
        {info.PseudonymEditable
            ? <><button type="button" className="ib-btn ib-btn--sm" onClick={() => { setValue(info.Pseudonym ?? ""); setEditing(true); }}>{info.Pseudonym ? t("participation.pseudonym.change") : t("common.add")}</button>
                {info.Pseudonym && <button type="button" className="ib-btn ib-btn--sm ib-btn--ghost" disabled={busy} onClick={() => void save(null)}>{t("participation.pseudonym.remove")}</button>}</>
            : <EventTooltip content={t("participation.pseudonym.locked")}>{id => <span className="event-pp-field__lock" tabIndex={0} aria-describedby={id} aria-label={t("participation.pseudonym.locked")}><Lock aria-hidden="true" /></span>}</EventTooltip>}
    </div>;
}

function VpnCard() {
    const vpn = useEventVpn();
    if (!vpn.available) return null;
    const text = vpn.status ? standStatusText(vpn.status) : null;
    return <Card title={t("participation.vpn.title")} note={t("participation.vpn.note")}>
        <div className={`event-vpn-stand is-${vpn.status ?? "unknown"}`} role="status"><StandStatusIcon status={vpn.status} /><div><b>{text?.title ?? t("vpn.modal.checkingStand")}</b>{text && <span>{text.note}</span>}</div></div>
        <div className="event-part__actions"><button type="button" className="ib-btn ib-btn--primary" onClick={vpn.openVpn}>{t("participation.vpn.setup")}</button></div>
    </Card>;
}

// The participant's own page: who they are, how they do and what they answered.
export function ProfileTab({event, info, team, finished, preview, now, onOpenTeam}: {
    event: PublicEventInfo; info: ParticipantEventInfo | null; team: OwnTeam | null; finished: boolean; preview: boolean; now: number; onOpenTeam: () => void;
}) {
    const queryClient = useQueryClient();
    const accent = useEventAccent();
    // The organizers' preview reads the real moderators team, so it is always a team.
    const teamMode = event.Participation === 1 || preview;
    const stats = useParticipationStats(event.EventID, {preview, enabled: true});
    const answers = useQuery({queryKey: ["event-own-answers", event.EventID], queryFn: () => getOwnParticipantAnswers(), enabled: !preview, retry: false, refetchOnWindowFocus: false});
    const data = stats.stats;
    const me = data?.Me;
    // In a team the participant's own line is their share of the solves; alone it is the whole result, hints paid from the balance included.
    const mine = data ? (teamMode ? ownSolves(data.Team.Solves, data.Me.UserID) : data.Team.Solves) : [];
    const points = data ? (teamMode ? data.Me.Points : data.Points) : 0;
    const series = data ? (teamMode ? cumulativePoints(solveEntries(mine)) : cumulativePoints(timelineEntries(data.Timeline))) : [];
    const lastAt = series.length ? series[series.length - 1][0] : null;
    const window = chartWindow(event.StartTime, event.FinishTime, now, lastAt);
    const scopeState: BlockState = !data ? (stats.state as BlockState) : mine.length === 0 ? "empty" : "ready";
    const save = async (draft: ParticipantAnswers) => {
        if (preview) { toast(t("participation.preview.noChanges")); return; }
        if (!answers.data) return;
        try {
            const changed = changedEditableAnswers(answers.data.Form, answers.data.Answers, draft, answers.data.Missing ?? []);
            if (Object.keys(changed).length) queryClient.setQueryData(["event-own-answers", event.EventID], await putOwnParticipantAnswers(event.EventID, changed));
            await queryClient.invalidateQueries({queryKey: ["event-participant-info", event.EventID]});
            toast.success(t("participation.fields.saved"));
        } catch (error) {
            throw new Error(errorText(error, t("participation.fields.saveFailed")), {cause: error});
        }
    };
    const tiles = statTiles({
        solves: data ? (teamMode ? data.Me.Solves : data.Solved) : 0, points, firstBloods: me?.FirstBloods ?? 0, hints: me?.Hints ?? 0,
        attempts: me?.Attempts ?? 0, correct: me?.CorrectAttempts ?? 0, scope: "me",
    });
    const shownTiles = tiles.map(tile => data ? tile : {...tile, value: "—", note: undefined});
    const admitted = team?.Admitted !== false;
    const teamName = preview ? t("participation.team.moderatorsName") : team?.Name;
    const name = info?.DisplayName || info?.RealName || me?.Name || "—";
    return <div className="event-pp">
        {preview && <div className="event-participation__banners ib-banner-stack"><EventBanner tone="info" title={t("participation.preview.title")} message={t("participation.preview.message")} /></div>}
        <section className="event-pp-card event-pp-hero" aria-label={t("participation.self.title")}>
            <div className="event-pp-hero__who">
                <h2 className="event-pp-hero__name">{name}</h2>
                {info?.AllowPseudonyms && info.RealName && info.DisplayName && info.DisplayName !== info.RealName && <span className="event-pp-hero__sub">{t("participation.self.realName", {name: info.RealName})}</span>}
                <div className="event-pp-hero__tags">
                    {preview
                        ? me && <span className="ib-tag ib-tag--role">{me.Role === 0 ? eventRoleLabel(0) : t("participation.team.member")}</span>
                        : <span className="ib-tag ib-tag--ok">{t("participation.self.confirmed")}</span>}
                    {teamMode && teamName && <>
                        <button type="button" className="ib-tag ib-tag--role" onClick={onOpenTeam} aria-label={t("participation.self.openTeam", {name: teamName})}>{teamName}</button>
                        {!admitted && <span className="ib-tag ib-tag--warn">{t("participation.team.incomplete")}</span>}
                    </>}
                </div>
                {info?.AllowPseudonyms && !preview && <PseudonymEditor info={info} eventID={event.EventID} />}
            </div>
            <dl className="event-pp-hero__score">
                {!preview && <div><dt>{teamMode ? t("participation.stats.teamPlace") : t("participation.stats.myPlace")}</dt><dd>{data ? placeText(data.Rank) : "—"}</dd></div>}
                <div><dt>{teamMode ? t("participation.stats.myPoints") : t("participation.stats.points")}</dt><dd>{data ? formatNumber(points) : "—"}</dd></div>
            </dl>
            <dl className="event-pp-dates">
                {me && <div><dt>{t("participation.dates.joined")}</dt><dd>{shortTime(me.JoinedAt)}</dd></div>}
                <div><dt>{t("participation.dates.start")}</dt><dd>{shortTime(event.StartTime)}</dd></div>
                {event.FinishTime && <div><dt>{t("participation.dates.finish")}</dt><dd>{shortTime(event.FinishTime)}</dd></div>}
            </dl>
        </section>
        <StatTiles label={t("participation.stats.title")} tiles={shownTiles} />
        <div className="event-pp-charts">
            <PointsChartCard event={event} title={t("participation.chart.points.title")} state={scopeState} error={stats.error} onRetry={stats.retry} window={window}
                series={[{name: t("participation.chart.points.mine"), points: series, color: accent}]} />
            <CategoryChartCard event={event} state={scopeState} solves={mine} color={accent} error={stats.error} onRetry={stats.retry} />
        </div>
        <SolvesTable event={event} state={scopeState} solves={mine} now={now} showSolver={false} error={stats.error} onRetry={stats.retry} title={t("participation.solves.title")} />
        {preview && <Card title={t("participation.form.cardTitle")}><EmptyState message={t("participation.preview.noForm")} compact /></Card>}
        {answers.isPending && !preview && <Card title={t("participation.form.cardTitle")}><EventLoading event={event} label={t("participation.loading")} /></Card>}
        {answers.isError && <Card title={t("participation.form.cardTitle")}><EventLoadError message={t("participation.fields.loadFailed")} error={answers.error} onRetry={() => void answers.refetch()} /></Card>}
        {answers.data && answers.data.Form.Enabled && <AnswersCard scope="participant" title={t("participation.form.cardTitle")} note={t("participation.self.note")} form={answers.data.Form} answers={answers.data.Answers}
            missing={answers.data.Missing ?? []} canEdit={answers.data.Editable && !finished} whyReadOnly={finished ? t("participation.form.finished") : t("participation.form.readOnly")} onSave={save} />}
        {!preview && <VpnCard />}
    </div>;
}
