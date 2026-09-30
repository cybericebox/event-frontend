"use client";

import Link from "next/link";
import {Fragment, useId, useState} from "react";
import {keepPreviousData, useQuery, useQueryClient} from "@tanstack/react-query";
import {toast} from "react-hot-toast";
import {ChevronDown, ChevronRight, Download, RotateCcw, SlidersHorizontal} from "lucide-react";
import {ApiErrorCode, apiErrorMessage} from "@/api/apiErrors";
import {ManageApiError} from "@/api/manage";
import {
    clampThresholds, defaultIntegrityFilters, deleteIntegrityReview, getAnalyticsIntegrity, integrityExportPath, integrityJournalHref, integrityKinds, integrityLevels,
    maxReviewNoteLength, putIntegrityReview, thresholdLimits, thresholdsEqual,
    type IntegrityFilters, type IntegrityItem, type IntegrityKind, type IntegrityReviewedFilter, type IntegrityThresholds,
} from "@/api/manageAnalyticsIntegrity";
import {csvFileName, downloadManageCSV} from "@/api/csvDownload";
import {EventLoadError} from "@/components/event/EventLoadError";
import {EventLoading} from "@/components/event/EventLoading";
import {LiveStatus} from "@/components/event/manage/LiveStatus";
import {ManageFieldLabel} from "@/components/event/manage/ManageFieldLabel";
import {ManageTable, type ManageTableState} from "@/components/event/manage/ManageTable";
import {useManager} from "@/components/event/manage/ManagerShell";
import {useJournalOptions} from "@/components/event/manage/journalShared";
import {ConfirmDialog} from "@/components/ui/ConfirmDialog";
import {EmptyState} from "@/components/ui/EmptyState";
import {EventButton} from "@/components/ui/EventButton";
import {EventSelect} from "@/components/ui/EventSelect";
import {t} from "@/i18n/t";
import {formatCount, formatDateTime} from "./analyticsFormat";
import {AnalyticsPage} from "./AnalyticsPage";
import {AnalyticsPeriodFilter} from "./AnalyticsPeriodFilter";
import {integrityFlagsKey, integrityKey, kindLabel, levelLabel, signalEvidence} from "./integrityModel";
import {loadThresholds, saveThresholds} from "./integrityThresholds";
import {useAnalyticsAccess} from "./useAnalyticsAccess";
import {useAnalyticsPeriod} from "./useAnalyticsPeriod";
import "./analyticsIntegrity.css";

export const INTEGRITY_POLL_SECONDS = 30;

const all = "all";
const reviewedOptions: IntegrityReviewedFilter[] = ["no", "yes", "all"];

export type IntegrityInitialFilters = {teamId?: string; challengeId?: string};

function ThresholdsPanel({defaults, applied, onApply, onReset}: {defaults: IntegrityThresholds; applied: IntegrityThresholds; onApply: (value: IntegrityThresholds) => void; onReset: () => void}) {
    const id = useId();
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState<IntegrityThresholds>(applied);
    const changed = !thresholdsEqual(clampThresholds(draft), applied);
    const isDefault = thresholdsEqual(applied, defaults);
    const number = (value: string) => value === "" ? 0 : Number(value);
    const unit = <span>{t("manage.analytics.integrity.thresholds.unitSeconds")}</span>;
    return <section className="event-integrity-thresholds" aria-label={t("manage.analytics.integrity.thresholds.title")}>
        <button className="event-integrity-thresholds__toggle" type="button" aria-expanded={open} aria-controls={`${id}-body`} onClick={() => setOpen(value => !value)}>
            <SlidersHorizontal size={16} aria-hidden="true" /> <strong>{t("manage.analytics.integrity.thresholds.title")}</strong>
            {!isDefault && <span className="ib-tag ib-tag--sm">{t("manage.analytics.integrity.thresholds.changed")}</span>}
            {open ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
        </button>
        {open && <div id={`${id}-body`} className="event-integrity-thresholds__body">
            <p className="event-integrity__notice">{t("manage.analytics.integrity.thresholds.subtitle")}</p>
            <h3 className="event-integrity-thresholds__group">{t("manage.analytics.integrity.thresholds.floorsTitle")}</h3>
            <div className="event-integrity-thresholds__grid">
                {integrityLevels.map(level => <div className="event-manage-field" key={level}>
                    <ManageFieldLabel htmlFor={`${id}-floor-${level}`} title={levelLabel(level)} help={t("manage.analytics.integrity.thresholds.floorHelp", {default: defaults.FloorSeconds[level], min: thresholdLimits.floor.min, max: thresholdLimits.floor.max})} />
                    <div className="event-integrity-thresholds__input">
                        <input id={`${id}-floor-${level}`} className="ib-input" type="number" inputMode="numeric" min={thresholdLimits.floor.min} max={thresholdLimits.floor.max} value={draft.FloorSeconds[level]}
                            onChange={event => setDraft(current => ({...current, FloorSeconds: {...current.FloorSeconds, [level]: number(event.target.value)}}))} />
                        {unit}
                    </div>
                </div>)}
            </div>
            <h3 className="event-integrity-thresholds__group">{t("manage.analytics.integrity.thresholds.othersTitle")}</h3>
            <div className="event-integrity-thresholds__grid">
                {([["BruteForceAttempts", "count"], ["BruteForceWindowSeconds", "seconds"], ["FollowGapSeconds", "seconds"]] as const).map(([key, kind]) => <div className="event-manage-field" key={key}>
                    <ManageFieldLabel htmlFor={`${id}-${key}`} title={t(`manage.analytics.integrity.thresholds.${key}`)} help={t(`manage.analytics.integrity.thresholds.${key}Help`, {default: defaults[key], min: thresholdLimits[key].min, max: thresholdLimits[key].max})} />
                    <div className="event-integrity-thresholds__input">
                        <input id={`${id}-${key}`} className="ib-input" type="number" inputMode="numeric" min={thresholdLimits[key].min} max={thresholdLimits[key].max} value={draft[key]}
                            onChange={event => setDraft(current => ({...current, [key]: number(event.target.value)}))} />
                        {kind === "seconds" ? unit : <span>{t("manage.analytics.integrity.thresholds.unitCount")}</span>}
                    </div>
                </div>)}
            </div>
            <div className="event-integrity-thresholds__actions">
                <button className="ib-btn ib-btn--sm" type="button" disabled={isDefault && !changed} onClick={() => {setDraft(defaults); onReset();}}><RotateCcw size={14} aria-hidden="true" /> {t("manage.analytics.integrity.thresholds.reset")}</button>
                <button className="ib-btn ib-btn--sm ib-btn--primary" type="button" disabled={!changed} onClick={() => onApply(clampThresholds(draft))}>{t("manage.analytics.integrity.thresholds.apply")}</button>
            </div>
        </div>}
    </section>;
}

function ExportButton({eventID, period, filters, thresholds, disabled}: {eventID: string; period: {from: string | null; to: string | null}; filters: IntegrityFilters; thresholds: IntegrityThresholds | null; disabled: boolean}) {
    const [busy, setBusy] = useState(false);
    async function download() {
        setBusy(true);
        try {await downloadManageCSV(eventID, integrityExportPath(period, filters, thresholds), csvFileName("analytics-integrity"));}
        catch {toast.error(t("manage.analytics.exportFailed"));}
        finally {setBusy(false);}
    }
    return <EventButton className="ib-btn" type="button" disabled={disabled || busy} busy={busy} onClick={() => void download()}><Download size={16} aria-hidden="true" /> {t("manage.analytics.export")}</EventButton>;
}

type ReviewDraft = {mode: "review" | "unreview"; item: IntegrityItem; note: string; busy: boolean; error: string | null};

function ReviewDialog({draft, onChange, onClose, onConfirm}: {draft: ReviewDraft | null; onChange: (patch: Partial<ReviewDraft>) => void; onClose: () => void; onConfirm: () => void}) {
    const id = useId();
    const review = draft?.mode === "review";
    const subject = draft ? t("manage.analytics.integrity.review.subject", {team: draft.item.TeamName, task: draft.item.ChallengeName}) : undefined;
    return <ConfirmDialog open={!!draft} onCancel={onClose} busy={draft?.busy ?? false} error={draft?.error}
        title={t(review ? "manage.analytics.integrity.review.title" : "manage.analytics.integrity.unreview.title")}
        description={t(review ? "manage.analytics.integrity.review.description" : "manage.analytics.integrity.unreview.description")}
        subject={subject} confirmLabel={t(review ? "manage.analytics.integrity.review.confirm" : "manage.analytics.integrity.unreview.confirm")} onConfirm={onConfirm}>
        {review && draft && <div className="event-manage-field">
            <label htmlFor={`${id}-note`}>{t("manage.analytics.integrity.review.note")}</label>
            <textarea id={`${id}-note`} className="event-manage-input" value={draft.note} maxLength={maxReviewNoteLength} disabled={draft.busy}
                placeholder={t("manage.analytics.integrity.review.notePlaceholder")} onChange={event => onChange({note: event.target.value, error: null})} />
            <small className="event-integrity__counter">{t("manage.analytics.integrity.review.counter", {count: draft.note.length, max: maxReviewNoteLength})}</small>
        </div>}
    </ConfirmDialog>;
}

function Evidence({item}: {item: IntegrityItem}) {
    const review = item.Review;
    return <div className="event-integrity__evidence">
        <ul>{item.Signals.map((signal, index) => <li key={`${signal.Kind}-${index}`}><span className="ib-tag ib-tag--sm ib-tag--warn">{kindLabel(signal.Kind)}</span> <span>{signalEvidence(signal, item.Level)}</span></li>)}</ul>
        {review && <p className="event-integrity__review">
            <strong>{t("manage.analytics.integrity.reviewed")}</strong> {t("manage.analytics.integrity.reviewedBy", {name: review.ReviewedBy || t("manage.analytics.integrity.reviewerUnknown"), date: formatDateTime(review.ReviewedAt)})}
            {review.Note && <span className="event-integrity__note">{review.Note}</span>}
        </p>}
    </div>;
}

// «Доброчесність» (docs/ANTI-CHEAT.md): flagged solves with their evidence, hints
// for a person to review, never a verdict. Only for viewers with the sensitive
// level; no IP or device data is used.
export function AnalyticsIntegrity({initialFilters = {}}: {initialFilters?: IntegrityInitialFilters}) {
    const {event} = useManager();
    const eventID = event.EventID;
    const queryClient = useQueryClient();
    const access = useAnalyticsAccess(eventID);
    const filter = useAnalyticsPeriod();
    const options = useJournalOptions();
    const [filters, setFilters] = useState<IntegrityFilters>(() => ({...defaultIntegrityFilters, teamID: initialFilters.teamId ?? null, challengeID: initialFilters.challengeId ?? null}));
    // null: the server defaults. The page mounts in the browser only (the
    // manager shell waits for its access check), so storage is readable here.
    const [thresholds, setThresholds] = useState<IntegrityThresholds | null>(() => loadThresholds(eventID));
    const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
    const [draft, setDraft] = useState<ReviewDraft | null>(null);
    const allowed = access.data?.Sensitive === true;
    const query = useQuery({
        queryKey: [...integrityKey(eventID), filter.period.from, filter.period.to, filters, thresholds],
        queryFn: () => getAnalyticsIntegrity(eventID, filter.period, filters, thresholds),
        enabled: allowed,
        refetchInterval: INTEGRITY_POLL_SECONDS * 1000,
        refetchOnWindowFocus: false,
        placeholderData: keepPreviousData,
    });
    const data = query.data;
    const title = t("manage.analytics.section.integrity.title");
    const description = t("manage.analytics.section.integrity.description");
    const patchFilters = (patch: Partial<IntegrityFilters>) => setFilters(current => ({...current, ...patch}));
    const actions = <>
        <LiveStatus freshness={{kind: "polling", seconds: INTEGRITY_POLL_SECONDS, failing: query.isError}} updatedAt={query.dataUpdatedAt} />
        <ExportButton eventID={eventID} period={filter.period} filters={filters} thresholds={thresholds} disabled={!data} />
    </>;

    async function confirm() {
        if (!draft || draft.busy) return;
        const current = draft;
        setDraft({...current, busy: true, error: null});
        try {
            if (current.mode === "review") await putIntegrityReview(eventID, current.item.TeamChallengeID, current.note.trim());
            else await deleteIntegrityReview(eventID, current.item.TeamChallengeID);
            await Promise.all([queryClient.invalidateQueries({queryKey: integrityKey(eventID)}), queryClient.invalidateQueries({queryKey: integrityFlagsKey(eventID)})]);
            setDraft(null);
            toast.success(t(current.mode === "review" ? "manage.analytics.integrity.review.done" : "manage.analytics.integrity.unreview.done"));
        } catch (error) {
            const known = error instanceof ManageApiError && (error.code === ApiErrorCode.EventAnalyticsSolveNotFound || error.code === ApiErrorCode.EventAnalyticsReviewNoteTooLong);
            const message = known ? apiErrorMessage(error.code) : t(current.mode === "review" ? "manage.analytics.integrity.review.failed" : "manage.analytics.integrity.unreview.failed");
            setDraft({...current, busy: false, error: message});
        }
    }

    if (access.isPending || (allowed && query.isPending)) return <AnalyticsPage title={title} description={description}>
        <div className="event-analytics__block"><EventLoading event={event} label={t("manage.analytics.integrity.loading")} /></div>
    </AnalyticsPage>;
    if (access.isError) return <AnalyticsPage title={title} description={description}>
        <div className="event-analytics__block"><EventLoadError message={t("manage.analytics.integrity.loadFailed")} error={access.error} onRetry={() => void access.refetch()} /></div>
    </AnalyticsPage>;
    if (!allowed) return <AnalyticsPage title={title} description={description}>
        <div className="event-analytics__block"><EmptyState message={t("manage.analytics.integrity.noAccess")} /></div>
    </AnalyticsPage>;
    if (!data) return <AnalyticsPage title={title} description={description} actions={actions}>
        <div className="event-analytics__block"><EventLoadError message={t("manage.analytics.integrity.loadFailed")} error={query.error} onRetry={() => void query.refetch()} /></div>
    </AnalyticsPage>;

    const items = data.Items;
    const state: ManageTableState = items.length === 0 ? "empty" : "ready";
    const narrowed = filters.signal !== null || filters.teamID !== null || filters.challengeID !== null || filters.reviewed !== defaultIntegrityFilters.reviewed;
    const toggle = (key: string) => setExpanded(current => {const next = new Set(current); if (!next.delete(key)) next.add(key); return next;});
    const applied = data.Thresholds;

    return <AnalyticsPage title={title} description={description} actions={actions} filter={<AnalyticsPeriodFilter period={filter} />}>
        <p className="event-integrity__notice">{t("manage.analytics.integrity.notice")}</p>
        <div className="event-integrity__chips" role="group" aria-label={t("manage.analytics.integrity.signalFilter")}>
            {integrityKinds.map((kind: IntegrityKind) => <button key={kind} type="button" className="event-integrity__chip" aria-pressed={filters.signal === kind}
                onClick={() => patchFilters({signal: filters.signal === kind ? null : kind})}>
                {kindLabel(kind)} <span className="event-integrity__chip-count">{formatCount(data.Counts[kind])}</span>
            </button>)}
        </div>
        <ThresholdsPanel key={JSON.stringify(applied)} defaults={data.Defaults} applied={applied}
            onApply={value => {const next = thresholdsEqual(value, data.Defaults) ? null : value; setThresholds(next); saveThresholds(eventID, next);}}
            onReset={() => {setThresholds(null); saveThresholds(eventID, null);}} />
        {data.Total > items.length && <p className="event-integrity__notice" role="status">{t("manage.analytics.integrity.truncated", {shown: items.length, total: data.Total})}</p>}
        <ManageTable event={event} state={state} loadingLabel={t("manage.analytics.integrity.loading")} errorMessage={t("manage.analytics.integrity.loadFailed")}
            emptyMessage={t(narrowed ? "manage.analytics.integrity.emptyFiltered" : "manage.analytics.integrity.empty")} onRetry={() => void query.refetch()} busy={query.isFetching}
            toolbar={<>
                <EventSelect ariaLabel={t("manage.analytics.integrity.teamFilter")} value={filters.teamID ?? all} options={options.teams} onValueChange={value => patchFilters({teamID: value === all ? null : value})} />
                <EventSelect ariaLabel={t("manage.analytics.integrity.taskFilter")} value={filters.challengeID ?? all} options={options.challenges} onValueChange={value => patchFilters({challengeID: value === all ? null : value})} />
                <div className="ib-seg" role="group" aria-label={t("manage.analytics.integrity.reviewedFilter")}>
                    {reviewedOptions.map(value => <button key={value} type="button" aria-pressed={filters.reviewed === value} onClick={() => patchFilters({reviewed: value})}>{t(`manage.analytics.integrity.reviewedOption.${value}`)}</button>)}
                </div>
            </>}
            head={<tr>
                <th scope="col" className="event-integrity__toggle-col"><span className="sr-only">{t("manage.analytics.integrity.col.evidence")}</span></th>
                <th scope="col">{t("manage.analytics.integrity.col.team")}</th>
                <th scope="col">{t("manage.analytics.integrity.col.task")}</th>
                <th scope="col">{t("manage.analytics.integrity.col.solved")}</th>
                <th scope="col">{t("manage.analytics.integrity.col.signals")}</th>
                <th scope="col" className="ib-num">{t("manage.analytics.integrity.col.count")}</th>
                <th scope="col" className="event-manage-table__actions-col"><span className="sr-only">{t("manage.analytics.integrity.col.actions")}</span></th>
            </tr>}>
            <tbody>{items.map(item => {
                const open = expanded.has(item.TeamChallengeID);
                return <Fragment key={item.TeamChallengeID}>
                    <tr>
                        <td className="event-integrity__toggle-col">
                            <button className="ib-btn ib-btn--sm ib-btn--icon" type="button" aria-expanded={open} aria-label={t("manage.analytics.integrity.toggle", {team: item.TeamName, task: item.ChallengeName})} onClick={() => toggle(item.TeamChallengeID)}>
                                {open ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
                            </button>
                        </td>
                        <td><Link href="/manage/teams">{item.TeamName}</Link></td>
                        <td><span className="event-integrity__task"><strong>{item.ChallengeName}</strong><span className="ib-tag ib-tag--sm">{levelLabel(item.Level)}</span></span></td>
                        <td className="event-manage-table__nowrap">{formatDateTime(item.SolvedAt)}</td>
                        <td><div className="event-manage-table__tags">
                            {item.Signals.map((signal, index) => <span className="ib-tag ib-tag--sm ib-tag--warn" key={`${signal.Kind}-${index}`}>{kindLabel(signal.Kind)}</span>)}
                            {item.Review && <span className="ib-tag ib-tag--sm ib-tag--ok">{t("manage.analytics.integrity.reviewed")}</span>}
                        </div></td>
                        <td className="ib-num">{formatCount(item.Signals.length)}</td>
                        <td className="event-manage-table__actions-col"><div className="event-integrity__actions">
                            <Link className="ib-btn ib-btn--sm" href={integrityJournalHref(item)}>{t("manage.analytics.integrity.openJournal")}</Link>
                            {item.Review
                                ? <button className="ib-btn ib-btn--sm" type="button" onClick={() => setDraft({mode: "unreview", item, note: "", busy: false, error: null})}>{t("manage.analytics.integrity.unreview.action")}</button>
                                : <button className="ib-btn ib-btn--sm" type="button" onClick={() => setDraft({mode: "review", item, note: "", busy: false, error: null})}>{t("manage.analytics.integrity.review.action")}</button>}
                        </div></td>
                    </tr>
                    {open && <tr className="event-integrity__detail"><td colSpan={7}><Evidence item={item} /></td></tr>}
                </Fragment>;
            })}</tbody>
        </ManageTable>
        <ReviewDialog draft={draft} onChange={patch => setDraft(current => current && {...current, ...patch})} onClose={() => setDraft(null)} onConfirm={() => void confirm()} />
    </AnalyticsPage>;
}
