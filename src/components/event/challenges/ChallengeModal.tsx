"use client";

import {useNativeDialogLayer} from "@/components/ui/useNativeDialogLayer";
import {useEffect, useId, useMemo, useRef, useState, type FormEvent} from "react";
import {ChallengeSolvesTab} from "./ChallengeSolvesTab";
import {labAccessScope} from "./labAccessScope";
import {LabControls} from "./LabControls";
import {ChallengeLabStatus} from "./ChallengeLabStatus";
import {AttachmentDownload} from "./AttachmentDownload";
import {useLabLink, labLinkErrorMessage} from "./useLabLink";
import {challengeContentReadiness} from "./challengeContentReadiness";
import {descriptionValues, hasCurrentRuntime} from "./descriptionValues";
import {skipToken, useQuery, useQueryClient} from "@tanstack/react-query";
import type {LabLifecycle} from "@/api/labLifecycle";
import {labLifecycleKey, newestLab, questionLabPinKey, rememberLab, rememberRuntimeQuestionLab} from "./labLifecycleCache";
import {ChevronDown, Lightbulb, Network} from "lucide-react";
import {ApiErrorCode, apiErrorMessage} from "@/api/apiErrors";
import {
    challengeAttachmentUrl, challengeFiles, getOwnChallengeLab, ParticipantChallengeError, submitChallenge, unlockChallengeHint,
    type BoardStage, type ChallengeHint, type OwnChallenge, type ChallengeSubmission,
} from "@/api/participantChallenges";
import {reportTaskOpened} from "@/api/taskOpenedBeacon";
import {useParticipantPreview} from "../ParticipantPreview";
import {EventSelect} from "@/components/ui/EventSelect";
import {getTestRunLengths, initialLength, testRunLengthsKey} from "@/api/testRunLengths";
import {moderatorFileUrl, submitModeratorFlag, type ModeratorSubmission} from "@/api/moderatorsBoard";
import {getModeratorChallengeLab, type LabRuntime} from "@/api/manageLabs";
import {EventRichTextView} from "@/components/event/content/EventRichTextView";
import {EventLoading} from "@/components/event/EventLoading";
import {richTextHasContent, richTextVariableNames} from "@/components/event/content/richTextState";
import {useEventVpn} from "@/components/event/vpn/EventVpn";
import {attemptsLeft, awardedPoints, difficultyLabel, formatClock, NO_SPEND, spendAttempt, type AttemptSpend} from "./challengeBoardModel";
import {t} from "@/i18n/t";
import {overloadedMessage} from "@/i18n/apiError";
import {richMessage} from "./richMessage";
import {hintConfirmText, hintCostLabel, hintDocument, hintLevelLabel, hintModeNote, hintNeedsConfirm, hintUnlockError, pointsLabel, type HintChargeMode} from "./hintModel";
import {EventButton} from "@/components/ui/EventButton";
import {ConfirmDialog} from "@/components/ui/ConfirmDialog";
import {EventTooltip} from "@/components/ui/EventTooltip";

import {getPreviewLab, previewBoardKey, previewFileUrl, runningTestLabs, startPreviewRun, stopOwnTestLab, submitPreviewFlag, unlockPreviewHint} from "@/api/participantPreview";
import type {OwnBoard} from "@/api/participantChallenges";
import {EventLoadError} from "@/components/event/EventLoadError";
import {EmptyState} from "@/components/ui/EmptyState";

export type BoardMode = "participant" | "moderators" | "preview";
type ObservedRuntime = LabRuntime & {previewRunID?: string | null; Expired?: boolean; Removing?: boolean};
class PreviewRuntimeError extends Error {
    constructor(readonly previewRunID: string | null | undefined, readonly failure: unknown) {
        super("Preview runtime request failed");
    }
}

// No free test capacity for the preview's laboratory (409; detail codes of the calendar): no room now, the run's
// reservation full, not enough reserved. The preview takes the starting staff member's test lease like the studio.
const PREVIEW_NO_FREE_RESOURCES = new Set([2508, 2509, 2517]);
// The caller's test-lab cap is reached (409, ErrTestDeployActiveExists): the error names the running labs.
const TEST_LAB_LIMIT = 963;

// At the test-lab cap nothing is replaced: the running labs are named, each with its own deliberate «Зупинити».
function TestLabLimit({eventID, labs, onStopped}: {eventID: string; labs: {ID: string; Name: string; EventID?: string}[]; onStopped: () => void}) {
    const [stopping, setStopping] = useState<string | null>(null);
    const [failed, setFailed] = useState<unknown>(null);
    const stop = async (id: string) => {
        setStopping(id); setFailed(null);
        try { await stopOwnTestLab(eventID, id); onStopped(); } catch (error) { setFailed(error); } finally { setStopping(null); }
    };
    return <div className="event-cmodal__limit" role="alert">
        <p>{t("lab.preview.limit.title")}</p>
        <ul>{labs.map(lab => <li key={lab.ID}>
            <span>{t(lab.EventID ? "lab.preview.limit.preview" : "lab.preview.limit.studio", {name: lab.Name || t("lab.preview.limit.unnamed")})}</span>
            <EventButton className="ib-btn ib-btn--sm" busy={stopping === lab.ID} busyLabel={t("common.busy.stopping")} disabled={!!stopping} onClick={() => void stop(lab.ID)}>{t("lab.preview.limit.stop")}</EventButton>
        </li>)}</ul>
        {!!failed && <p className="ib-cmodal__msg is-error">{apiErrorMessage(failed instanceof ParticipantChallengeError ? failed.code : undefined, t("lab.preview.limit.stopFailed"))}</p>}
    </div>;
}
// retry: the server was only busy; the message offers to send the same answer again.
type Message = {text: string; tone: "error" | "warn"; retry?: boolean} | null;

const svg = (path: React.ReactNode) => <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">{path}</svg>;
const ICON = {
    x: svg(<path d="M6 6l12 12M18 6L6 18" />),
    dl: svg(<path d="M12 4v11M7 10l5 5 5-5M5 20h14" />),
    copy: svg(<><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></>),
    check: svg(<path d="M5 12.5l4.5 4.5L19 7.5" />),
    ext: svg(<path d="M14 4h6v6M20 4l-9 9M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />),
};

// Participant errors on submit; the rate limit carries its own countdown.
function submitMessage(error: unknown): Message {
    if (error instanceof ParticipantChallengeError) {
        if (error.code === ApiErrorCode.TeamNotAdmitted) return {text: t("challenges.hint.error.notAdmitted"), tone: "warn"};
        if (error.code === ApiErrorCode.AnswerTooLong) return {text: apiErrorMessage(error.code, t("challenges.submit.failed")), tone: "error"};
        if (error.code === ApiErrorCode.AttemptLimitReached) return {text: t("challenges.modal.attemptsExhausted"), tone: "warn"};
        if (error.code === ApiErrorCode.StageClosed) return {text: t("challenges.submit.stageClosed"), tone: "warn"};
        // The same answer is still being processed after the automatic tries: the server is busy, the same key may be sent again.
        if (error.code === ApiErrorCode.AnswerInProgress) return {text: t("error.overloaded"), tone: "warn", retry: true};
        if (error.status === 409 || error.status === 403) return {text: t("challenges.submit.notAccepting"), tone: "warn"};
    }
    const overloaded = overloadedMessage(error);
    if (overloaded) return {text: overloaded, tone: "warn", retry: true};
    return {text: t("challenges.submit.failed"), tone: "warn"};
}

// What only moderators see, below the task text: how the lab is reached (no links, they live in the text) and the note about answers.
function ModeratorsBlock({lab, lifecycle, infrastructure}: {lab: LabRuntime | undefined; lifecycle: LabLifecycle | null; infrastructure: boolean}) {
    const access = hasCurrentRuntime(lab, lifecycle) ? lab?.Access ?? [] : [];
    const methods = [
        access.some(item => !item.URL && !/^https?$/i.test(item.Protocol)) && t("challenges.moderators.access.vpn"),
        access.some(item => !!item.URL || /^https?$/i.test(item.Protocol)) && t("challenges.moderators.access.web"),
    ].filter(Boolean);
    return <section className="event-cmodal__mods" aria-label={t("challenges.moderators.only")}>
        <p className="event-cmodal__mods-caption">{t("challenges.moderators.only")}</p>
        {infrastructure && methods.length > 0 && <p>{t("challenges.moderators.access", {method: methods.join(", ")})}</p>}
        <p>{t("challenges.modal.moderatorsNote")}</p>
    </section>;
}

// The solved state replaces the answer form: the points the team got (with the hint price), when and by whom. A practice solve earns nothing.
function SolvedPanel({challenge, practice, at}: {challenge: OwnChallenge; practice: boolean; at: string}) {
    const awarded = awardedPoints(challenge);
    const penalty = challenge.HintPenalty ?? 0;
    const when = [challenge.SolvedBy?.Name, formatClock(at)].filter(Boolean).join(", ");
    return <div className="ib-cmodal__ok event-cmodal__solved" role="status">
        {ICON.check}
        <span className="event-cmodal__solved-main">
            <b>{practice ? t("challenges.modal.solvedPractice") : t("challenges.modal.solved")}</b>
            {!practice && <span className="ib-num">{penalty > 0 ? t("challenges.modal.solvedPenalty", {awarded, total: awarded + penalty, penalty}) : `+${awarded}`}</span>}
            {when && <small>{when}</small>}
        </span>
    </div>;
}

// A hint text renders formatted like the description; plain text from older
// exercises stays a paragraph.
function HintText({text, variables, links, openVariables, onRetry, runtimeUnavailable = false}: {text: string; variables?: Record<string, string>; links?: Record<string, string>; openVariables?: Record<string, (destinationURL?: string) => void>; onRetry?: () => void; runtimeUnavailable?: boolean}) {
    const document = hintDocument(text);
    const names = [...richTextVariableNames(document)];
    if (names.some(name => variables?.[name] == null || runtimeUnavailable && variables[name] === "—")) return <EventLoadError compact message={t("challenges.lab.unavailable")} onRetry={onRetry} />;
    if (names.some(name => variables?.[name] === "—")) return <EventLoading compact label={t("challenges.lab.starting")} />;
    return document ? <div className="ib-cmodal__desc event-cmodal__hint-text"><EventRichTextView value={document} variables={variables} links={links} openVariables={openVariables} /></div> : <p>{text}</p>;
}

// Hints: participants see each hint's price, never its level (moderators do);
// participants unlock one by one (paid ones after a confirm); the
// moderators board shows every text and never unlocks.
export function HintsBlock({challenge, eventID, moderators, chargeMode, onUnlocked, closed = false, previewMode = false, variables, links, openVariables, teamMode = false, onRuntimeRetry, runtimeUnavailable = false}: {
    challenge: OwnChallenge; eventID: string; moderators: boolean; chargeMode: HintChargeMode; onUnlocked: () => void;
    // The stage is closed: unlocked texts stay readable, nothing new opens.
    closed?: boolean;
    previewMode?: boolean;
    teamMode?: boolean;
    onRuntimeRetry?: () => void;
    runtimeUnavailable?: boolean;
    variables?: Record<string, string>;
    links?: Record<string, string>;
    openVariables?: Record<string, (destinationURL?: string) => void>;
}) {
    const preview = useParticipantPreview(eventID);
    const isPreview = previewMode || preview.active;
    const [localHints, setLocalHints] = useState<Record<string, ChallengeHint>>({});
    const [expanded, setExpanded] = useState(true);
    const [expandedHints, setExpandedHints] = useState<Record<string, boolean>>({});
    const hintsID = useId();
    const moderatorPresentation = moderators && !isPreview;
    const [confirm, setConfirm] = useState<{hint: ChallengeHint; index: number} | null>(null);
    const [busyID, setBusyID] = useState<string | null>(null);
    const [error, setError] = useState("");
    const [confirmError, setConfirmError] = useState("");
    const unlockedCount = challenge.Hints.filter(hint => (localHints[hint.ID] ?? hint).Unlocked).length;
    const paid = challenge.Hints.some(hint => hint.Cost > 0);

    async function unlock(hint: ChallengeHint) {
        if (busyID) return;
        setBusyID(hint.ID);
        setError("");
        try {
            const revealed = isPreview ? await unlockPreviewHint(eventID, challenge, hint.ID) : await unlockChallengeHint(eventID, challenge.EventChallengeID, hint.ID);
            setLocalHints(current => ({...current, [hint.ID]: revealed}));
            setExpandedHints(current => ({...current, [hint.ID]: true}));
            setConfirm(null);
            onUnlocked();
        } catch (failure) {
            // A failed confirmed unlock keeps the dialog open with the reason inside.
            if (confirm) setConfirmError(hintUnlockError(failure));
            else setError(hintUnlockError(failure));
        } finally {
            setBusyID(null);
        }
    }

    return <section className="ib-cmodal__blk">
        <h3><button type="button" className="event-cmodal__hints-toggle" aria-expanded={expanded} aria-controls={hintsID} aria-label={t("challenges.hints.countLabel", {unlocked: unlockedCount, total: challenge.Hints.length})} onClick={() => {if (expanded) setExpandedHints(Object.fromEntries(challenge.Hints.map(hint => [hint.ID, false]))); setExpanded(current => !current);}}>{t("challenges.hints.title")}<span className="event-cmodal__hints-count"><span className="ib-num">{t("challenges.hints.count", {unlocked: unlockedCount, total: challenge.Hints.length})}</span><ChevronDown aria-hidden="true" /></span></button></h3>
        <div id={hintsID} hidden={!expanded}>
        {!moderatorPresentation && (paid || challenge.HintCostTotal > 0) && <p className="ib-cmodal__hint event-cmodal__hint-mode">
            {hintModeNote(chargeMode)}{challenge.HintCostTotal > 0 && <> {richMessage(t("challenges.hints.spent"), {points: <span className="ib-num">{pointsLabel(challenge.HintCostTotal)}</span>})}</>}
        </p>}
        <ul className="event-cmodal__hints">{challenge.Hints.map((original, index) => {const hint = localHints[original.ID] ?? original; const bodyID = `${hintsID}-${index}`; const bodyExpanded = expandedHints[hint.ID] ?? true; return <li key={hint.ID}>
            <div className="event-cmodal__hint-head">
                {hint.Unlocked || moderatorPresentation
                    ? <button type="button" className="event-cmodal__hint-toggle" aria-expanded={bodyExpanded} aria-controls={bodyID} onClick={() => setExpandedHints(current => ({...current, [hint.ID]: !bodyExpanded}))}>
                        <span className="event-cmodal__hint-title">{moderatorPresentation ? t("challenges.hints.itemWithLevel", {number: index + 1, level: hintLevelLabel(hint.Level)}) : t("challenges.hints.item", {number: index + 1})}<span className="ib-num"> · {hintCostLabel(hint.Cost)}</span></span><ChevronDown aria-hidden="true" />
                    </button>
                    : <span className="event-cmodal__hint-title">{t("challenges.hints.item", {number: index + 1})}<span className="ib-num"> · {hintCostLabel(hint.Cost)}</span></span>}
                {!moderatorPresentation && !hint.Unlocked && !closed && <EventTooltip floating content={t("challenges.hints.openCost", {cost: hintCostLabel(hint.Cost)})}>{tooltipID => <EventButton className="ib-icon-btn ib-icon-btn--sm event-cmodal__hint-open" aria-label={t("challenges.hints.openCost", {cost: hintCostLabel(hint.Cost)})} aria-describedby={tooltipID} disabled={!!busyID} busy={busyID === hint.ID} busyLabel={t("common.busy.unlocking")}
                    onClick={() => {if (hintNeedsConfirm(hint)) {setConfirmError(""); setConfirm({hint, index});} else void unlock(hint);}}><Lightbulb aria-hidden="true" /></EventButton>}</EventTooltip>}
            </div>
            {(hint.Unlocked || moderatorPresentation) && <div className="event-cmodal__hint-body" id={bodyID} hidden={!bodyExpanded} tabIndex={hint.Content ? 0 : undefined}>
            {hint.Content && <HintText text={hint.Content} variables={variables} links={links} openVariables={openVariables} onRetry={onRuntimeRetry} runtimeUnavailable={runtimeUnavailable} />}
            {!isPreview && hint.Unlocked && hint.UnlockedByName && <p className="ib-cmodal__hint">{t("challenges.hints.unlockedBy", {name: hint.UnlockedByName})}{hint.UnlockedAt && <> · <span className="ib-num">{formatClock(hint.UnlockedAt, true)}</span></>}</p>}
            </div>}
        </li>;})}</ul>
        {closed && !moderatorPresentation && <p className="ib-cmodal__hint">{t("challenges.hint.error.stageClosed")}</p>}
        {error && <p className="ib-cmodal__msg is-warn" role="alert">{error}</p>}
        </div>
        <ConfirmDialog open={!!confirm} onCancel={() => setConfirm(null)} busy={!!busyID} error={confirmError}
            title={confirm ? t("challenges.hints.confirmTitle", {number: confirm.index + 1}) : ""}
            description={confirm ? hintConfirmText(chargeMode, confirm.hint.Cost, teamMode) : undefined}
            confirmLabel={t("challenges.hints.confirm")} busyLabel={t("common.busy.unlocking")} onConfirm={() => confirm && void unlock(confirm.hint)}>
            {teamMode && <p className="ib-cmodal__hint">{t("challenges.hints.teamSees")}</p>}
        </ConfirmDialog>
    </section>;
}

// React port of ds-v2 IB.ChallengeModal on a native <dialog>.
export function ChallengeModal({challenge, stage = null, eventID, mode, teamMode, finished, showDifficulty, showHints, hintChargeMode = "reward", onClose, onAccepted, onRejected, onHintUnlocked, onOpeningChange}: {
    challenge: OwnChallenge | null;
    // The stage of the task's set, when it has one (only opened stages are known to the board).
    stage?: BoardStage | null;
    eventID: string;
    mode: BoardMode;
    teamMode: boolean;
    finished: boolean;
    showDifficulty: boolean;
    showHints: boolean;
    hintChargeMode?: HintChargeMode;
    onClose: () => void;
    onOpeningChange?: (challengeID: string, preparing: boolean) => void;
    onAccepted: (challengeID: string, result: ChallengeSubmission | ModeratorSubmission) => void;
    // A wrong answer was counted: the board refetches the attempts left.
    onRejected?: () => void;
    onHintUnlocked?: () => void;
}) {
    const ref = useRef<HTMLDialogElement>(null);
    const opener = useRef<Element | null>(null);
    const titleRef = useRef<HTMLHeadingElement>(null);
    const flagRef = useRef<HTMLInputElement>(null);
    const taskTabRef = useRef<HTMLButtonElement>(null);
    const solvesTabRef = useRef<HTMLButtonElement>(null);
    const id = useId();
    const vpn = useEventVpn();
    const [tab, setTab] = useState<"task" | "solves">("task");
    // A mouse click on a tab never draws the focus ring; the keyboard does.
    const [pointer, setPointer] = useState(false);
    const [answer, setAnswer] = useState("");
    const [message, setMessage] = useState<Message>(null);
    const [busy, setBusy] = useState(false);
    // One idempotency key per answer: a retry of the same answer (automatic or by the user) reuses it, so the
    // server replays a completed attempt instead of counting another; a changed answer or a verdict ends it.
    const submitKey = useRef<{answer: string; key: string} | null>(null);
    const [accepted, setAccepted] = useState(false);
    // The accepted answer was a practice one (the stage had already closed): no points are shown for it.
    const [practiceAnswer, setPracticeAnswer] = useState(false);
    const [spend, setSpend] = useState<AttemptSpend>(NO_SPEND);
    const [waitUntil, setWaitUntil] = useState(0);
    // The announced text stays constant (the full wait); only the visible countdown ticks.
    const [waitTotal, setWaitTotal] = useState(0);
    const [now, setNow] = useState(() => Date.now());
    const challengeID = challenge?.EventChallengeID;
    const preview = useParticipantPreview(eventID);
    const isPreview = mode === "preview" || preview.active;
    const cacheMode = isPreview ? "preview" : mode;
    const [starting, setStarting] = useState(false);
    const [retryingRuntime, setRetryingRuntime] = useState(false);
    const [startError, setStartError] = useState<unknown>();
    // The run length of the preview's laboratory; 0 until the author picks one (the offered default applies).
    const [chosenLength, setChosenLength] = useState(0);
    const [startedRun, setStartedRun] = useState<{selectionID: string; id: string; replaces: string | null | undefined; expiresAt: string | null} | null>(null);
    const admittedScope = useRef<string | null>(null);
    const selectionID = challenge?.PreviewSelectionID;
    const previewRunStarted = (!!challenge?.PreviewRunID && (!challenge.PreviewExpiresAt || Date.parse(challenge.PreviewExpiresAt) > now)) || (startedRun?.selectionID === selectionID && !!startedRun && (!startedRun.expiresAt || Date.parse(startedRun.expiresAt) > now));
    const localRun = startedRun?.selectionID === selectionID && (!challenge?.PreviewRunID || challenge.PreviewRunID === startedRun?.replaces || challenge.PreviewRunID === startedRun?.id) ? startedRun : null;
    const previewRunID = localRun?.id ?? challenge?.PreviewRunID;
    const previewExpiresAt = localRun?.expiresAt ?? challenge?.PreviewExpiresAt;
    // Local launch identity bridges only the board's refresh; after its
    // acknowledgement, a later missing run must remain missing (stop/expiry).
    if (startedRun && challenge?.PreviewRunID === startedRun.id) setStartedRun(null);
    useEffect(() => {
        if (!isPreview || !previewExpiresAt) return;
        const delay = Date.parse(previewExpiresAt) - Date.now();
        if (!Number.isFinite(delay)) return;
        const timer = window.setTimeout(() => setNow(Date.now()), Math.min(2_147_000_000, Math.max(1, delay + 1)));
        return () => window.clearTimeout(timer);
    }, [isPreview, previewExpiresAt]);
    const moderators = mode === "moderators";
    const moderatorPresentation = moderators && !preview.active;
    const queryClient = useQueryClient();

    const runtimeWithdrawn = !isPreview && !moderators && (!!challenge?.Closed || stage?.State === "closed" || finished);
    const runtimeKey = useMemo(() => ["event-challenge-lab", cacheMode, eventID, challengeID], [cacheMode, eventID, challengeID]);
    const beforeFetch = labAccessScope(queryClient, cacheMode, eventID, challengeID, challenge?.Lab, queryClient.getQueryData<LabRuntime>(runtimeKey));
    const lab = useQuery<ObservedRuntime>({
        queryKey: runtimeKey,
        queryFn: async ({signal}) => {
            const pinKey = questionLabPinKey(queryClient, cacheMode, eventID, challengeID!);
            let runtime: ObservedRuntime;
            try {
                runtime = await (isPreview ? getPreviewLab(eventID, selectionID ?? "") : moderators ? getModeratorChallengeLab(eventID, challengeID!) : getOwnChallengeLab(eventID, challengeID!));
            } catch (failure) {
                signal.throwIfAborted();
                throw isPreview ? new PreviewRuntimeError(previewRunID, failure) : failure;
            }
            signal.throwIfAborted();
            if (runtime.Lab) {
                rememberLab(queryClient, cacheMode, eventID, runtime.Lab);
                const currentPinKey = questionLabPinKey(queryClient, cacheMode, eventID, challengeID!);
                const sameIdentity = (pinKey[3] === null || pinKey[3] === currentPinKey[3]) && (pinKey[4] === null || pinKey[4] === currentPinKey[4]);
                if (sameIdentity) rememberRuntimeQuestionLab(queryClient, cacheMode, eventID, challengeID!, runtime.Lab);
            }
            // The preview endpoint is selection-scoped, while this query key is
            // question-scoped. Fence cached addresses to the run that produced them.
            return {...runtime, ...(isPreview ? {previewRunID} : {})};
        },
        enabled: !!challenge?.Infrastructure && !challenge.Locked && (!isPreview || previewRunStarted) && !runtimeWithdrawn && !beforeFetch.lifecycle?.LogicalClosed,
        retry: false, refetchInterval: query => {
            const current = labAccessScope(queryClient, cacheMode, eventID, challengeID, challenge?.Lab, query.state.data);
            if (runtimeWithdrawn || current.lifecycle?.LogicalClosed) return false;
            const pendingContent = challenge && challengeContentReadiness(challenge, descriptionValues(challenge.Snapshot.placeholders, query.state.data, current.lifecycle), showHints, moderatorPresentation) === "preparing";
            return !query.state.data?.Ready || query.state.data?.Queue || !hasCurrentRuntime(query.state.data, current.lifecycle) || pendingContent ? 8000 : 30000;
        }, refetchOnWindowFocus: false,
    });
    const {data: observedRuntime, isFetching: fetchingRuntime, refetch: refetchRuntime} = lab;
    const errorIsCurrent = lab.isError && (!isPreview || lab.error instanceof PreviewRuntimeError && lab.error.previewRunID === previewRunID);
    const runtimeFailure = errorIsCurrent ? lab.error instanceof PreviewRuntimeError ? lab.error.failure : lab.error : undefined;
    const currentObservation = observedRuntime?.previewRunID === previewRunID || errorIsCurrent;
    const previewScope = isPreview && previewRunStarted && challenge?.Infrastructure && !challenge.Locked ? JSON.stringify([eventID, challengeID, previewRunID]) : null;
    const previousPreviewScope = useRef<string | null>(null);
    useEffect(() => {
        const changedRun = previousPreviewScope.current !== null && previousPreviewScope.current !== previewScope;
        previousPreviewScope.current = previewScope;
        if (!previewScope || !queryClient.getQueryCache().find({queryKey: runtimeKey, exact: true})) return;
        if (changedRun) {
            // A first GET with no data cannot be replaced by refetch alone.
            // Cancel the obsolete run explicitly; its signal fence rejects any
            // delayed result before starting this run under the existing key.
            void queryClient.cancelQueries({queryKey: runtimeKey, exact: true});
            void refetchRuntime();
        } else if (!currentObservation && !fetchingRuntime) {
            void refetchRuntime();
        }
    }, [previewScope, currentObservation, fetchingRuntime, queryClient, runtimeKey, refetchRuntime]);
    const accessScope = labAccessScope(queryClient, cacheMode, eventID, challengeID, challenge?.Lab, lab.data);
    const lifecycleKey = labLifecycleKey(cacheMode, eventID, accessScope.lifecycle?.ID ?? "");
    const lifecycle = useQuery<LabLifecycle>({
        queryKey: lifecycleKey, queryFn: skipToken, enabled: false, gcTime: Infinity,
    });
    // Subscribe to shared closure independently of a question's runtime request.
    const effectiveLifecycle = accessScope.lifecycle && lifecycle.data?.ID === accessScope.lifecycle.ID
        ? newestLab(accessScope.lifecycle, lifecycle.data) : accessScope.lifecycle;
    const runtime = runtimeWithdrawn || isPreview && (!previewRunStarted || lab.data?.previewRunID !== previewRunID) ? undefined : lab.data;
    const labLink = useLabLink(eventID, challengeID, moderators, effectiveLifecycle ?? undefined, runtimeWithdrawn, isPreview ? selectionID : undefined);
    // The moderators board lists its own team's solves; participants see them only when the event shows counts.
    const solvesVisible = isPreview || moderators || (challenge?.SolveCount !== null && challenge?.SolveCount !== undefined);

    // A new challenge starts on its task tab with a clean flag form.
    const [shownID, setShownID] = useState(challengeID);
    if (shownID !== challengeID) {
        setShownID(challengeID);
        setTab("task");
        setAnswer("");
        setMessage(null);
        setAccepted(false);
        setPracticeAnswer(false);
        setStartError(undefined);
        submitKey.current = null;
    }

    const waiting = waitUntil > now;
    useEffect(() => {
        if (!waiting) return;
        const timer = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(timer);
    }, [waiting]);
    const waitSeconds = Math.max(0, Math.ceil((waitUntil - now) / 1000));

    async function submit(event: FormEvent) {
        event.preventDefault();
        await send();
    }

    async function send() {
        if (!challenge || busy || waiting) return;
        const value = answer.trim();
        if (!value) {
            setMessage({text: t("challenges.modal.flagEmpty"), tone: "error"});
            flagRef.current?.focus();
            return;
        }
        // Cache reset removes this session's Query object; a new login may build the same key.
        // Closing the dialog or refetching retains it, so valid same-session solves still apply.
        const cache = queryClient.getQueryCache();
        const scope = cache.find({queryKey: lifecycleKey, exact: true});
        const currentSession = () => !!scope && cache.find({queryKey: scope.queryKey, exact: true}) === scope;
        if (submitKey.current?.answer !== value) submitKey.current = {answer: value, key: crypto.randomUUID()};
        const key = submitKey.current.key;
        setBusy(true);
        setMessage(null);
        try {
            const result = isPreview ? await submitPreviewFlag(eventID, challenge, value) : moderators
                ? await submitModeratorFlag(eventID, challenge.EventChallengeID, value)
                : await submitChallenge(eventID, challenge.EventChallengeID, value, key);
            if (submitKey.current?.key === key) submitKey.current = null;
            if (!currentSession()) return;
            if (result.Lab) rememberLab(queryClient, cacheMode, eventID, result.Lab);
            const correct = result.Correct;
            // The server says whether it was rated: a stage that closed while the modal was open turns it into practice.
            const practiced = !moderators && "Practice" in result && result.Practice === true;
            if (correct) {
                setNow(Date.now());
                setPracticeAnswer(practiced);
                setAccepted(true);
                setAnswer("");
                onAccepted(challenge.EventChallengeID, result);
                titleRef.current?.focus();
            } else {
                setMessage({text: t("challenges.modal.flagRejected"), tone: "error"});
                flagRef.current?.focus();
                if (!moderators) {
                    setSpend(current => spendAttempt(challenge, current));
                    onRejected?.();
                }
            }
        } catch (error) {
            if (!currentSession()) return;
            if (error instanceof ParticipantChallengeError && error.code === ApiErrorCode.StageClosed) {
                setMessage(submitMessage(error));
                onRejected?.();
            } else if (error instanceof ParticipantChallengeError && error.code === ApiErrorCode.AttemptLimitReached) {
                setSpend(current => spendAttempt(challenge, current, true));
                setMessage(null);
                onRejected?.();
            } else if (error instanceof ParticipantChallengeError && error.status === 429) {
                const seconds = error.retryAfter || 30;
                setWaitUntil(Date.now() + seconds * 1000);
                setWaitTotal(seconds);
                setNow(Date.now());
                setMessage(null);
            } else {
                setMessage(submitMessage(error));
            }
        } finally {
            if (currentSession()) setBusy(false);
        }
    }

    const values = useMemo(() => descriptionValues(challenge?.Snapshot.placeholders ?? [], isPreview && !runtime?.Ready ? undefined : runtime, effectiveLifecycle ?? null), [challenge?.Snapshot.placeholders, runtime, effectiveLifecycle, isPreview]);
    const contentState = challenge ? challengeContentReadiness(challenge, values, showHints, moderatorPresentation) : "ready";
    const usable = !accessScope.identityMismatch && !!runtime?.Ready && hasCurrentRuntime(runtime, effectiveLifecycle);
    const runtimeEnded = isPreview && !!(runtime?.Expired || runtime?.Removing);
    const previewLeaseEnded = isPreview && !!previewRunID && !previewRunStarted;
    // A solved question can still use a shared live lab. Only actual closure
    // or withdrawal bypasses initial runtime admission for history/review.
    const review = !!challenge && (runtimeWithdrawn || !!effectiveLifecycle?.LogicalClosed || (runtimeEnded || previewLeaseEnded) && (!!challenge.SolvedAt || challenge.Practice));
    const noPreviewRun = isPreview && !!challenge?.Infrastructure && (!previewRunStarted || runtimeEnded);
    const unavailable = contentState === "unavailable" || effectiveLifecycle?.RuntimeState === "unavailable" || runtime?.Phase.toLowerCase() === "failed" || (errorIsCurrent && !retryingRuntime && !lab.isFetching);
    const contentScope = challengeID ? `${challengeID}:${isPreview ? `${previewRunID ?? ""}:${previewRunStarted && !runtimeEnded}` : ""}` : null;
    const opening = !challenge || review || contentScope !== null && admittedScope.current === contentScope ? "content" : noPreviewRun ? "setup"
        : contentState === "ready" && (!challenge.Infrastructure || usable) ? "content"
        : unavailable ? "setup" : "preparing";
    const showTask = !!challenge && opening === "content";
    const dialogOpen = !!challengeID && opening !== "preparing";
    useEffect(() => {
        if (showTask) admittedScope.current = contentScope;
        else if (!challengeID) admittedScope.current = null;
    }, [showTask, contentScope, challengeID]);
    useEffect(() => {
        if (challengeID) opener.current = document.activeElement;
    }, [challengeID]);
    useEffect(() => {
        if (challengeID) onOpeningChange?.(challengeID, opening === "preparing");
    }, [challengeID, opening, onOpeningChange]);
    useEffect(() => {
        const dialog = ref.current;
        if (!dialog) return;
        if (dialogOpen && !dialog.open) {
            dialog.showModal();
            titleRef.current?.focus();
        } else if (!dialogOpen && dialog.open) {
            dialog.close();
        }
    }, [dialogOpen, challengeID]);
    const releaseDialogLayer = useNativeDialogLayer(ref, dialogOpen);
    useEffect(() => {
        if (!showTask || isPreview || moderators || !challengeID || challenge?.Locked) return;
        reportTaskOpened(eventID, challengeID);
    }, [showTask, isPreview, moderators, eventID, challengeID, challenge?.Locked]);
    const retryRuntime = async () => {
        const cache = queryClient.getQueryCache();
        const scope = cache.find({queryKey: runtimeKey, exact: true});
        const currentSession = () => !!scope && cache.find({queryKey: runtimeKey, exact: true}) === scope;
        setRetryingRuntime(true);
        try {
            await lab.refetch();
            if (currentSession()) onRejected?.();
        } finally {
            if (currentSession()) setRetryingRuntime(false);
        }
    };
    const openVariables = Object.fromEntries((challenge?.Snapshot.placeholders ?? []).filter(item => item.kind === "external.link").map(item => {
        const access = runtime?.Access.find(access => access.Device === item.device_name);
        return [item.key, (destinationURL?: string) => {if (access) labLink.open(access.Device, access.Port, destinationURL);}];
    }));
    const files = challenge ? challengeFiles(challenge) : [];
    const solved = !!challenge?.SolvedAt;
    // A closed stage that is not returnable refuses answers and hints; one that is returnable and has ended takes them
    // as practice (checked and shown, never rated, hints free).
    const stageClosed = !moderators && !!challenge?.Closed;
    const practice = !moderators && !stageClosed && !!stage && stage.State === "closed" && stage.Returnable;
    const practiceSolved = !!challenge?.Practice && !solved;
    const left = challenge && !moderators ? attemptsLeft(challenge, spend) : null;
    const exhausted = left === 0;
    const shownHints = showHints && challenge?.HintsEnabled ? challenge.Hints : [];
    // Hints are free once the task is solved, after the finish and as practice (the server charges 0 then).
    const freeHints = practice || solved || (finished && !moderators);
    const hints = freeHints ? shownHints.map(hint => hint.Unlocked ? hint : {...hint, Cost: 0}) : shownHints;
    const fileUrl = (fileID: string) => isPreview ? previewFileUrl(eventID, challenge!, fileID) : moderators ? moderatorFileUrl(eventID, challengeID!, fileID) : challengeAttachmentUrl(eventID, challengeID!, fileID);

    const lengths = useQuery({
        queryKey: testRunLengthsKey, queryFn: getTestRunLengths, staleTime: 5 * 60_000, retry: false,
        enabled: noPreviewRun && challenge?.PreviewCanStart === true,
    });
    const lengthChoices = lengths.data && lengths.data.AllowedMinutes.length > 0 ? lengths.data : null;
    const runLength = chosenLength || (lengthChoices ? initialLength(lengthChoices) : 0);
    const start = async () => {
        if (starting || !selectionID || challenge?.PreviewCanStart !== true) return;
        const cache = queryClient.getQueryCache();
        const scope = cache.find({queryKey: runtimeKey, exact: true});
        const currentSession = () => !!scope && cache.find({queryKey: runtimeKey, exact: true}) === scope;
        setStarting(true); setStartError(undefined);
        try {
            const run = await startPreviewRun(eventID, selectionID, runLength || undefined);
            if (!currentSession()) return;
            queryClient.setQueryData<ObservedRuntime>(runtimeKey, {previewRunID: run.ID, Lab: null, Phase: "pending", Ready: false, Queue: null, VPNCIDR: "", InternetCIDR: "", Access: []});
            queryClient.setQueryData<OwnBoard>(previewBoardKey(eventID), board => board && ({...board, Challenges: board.Challenges.map(task => task.PreviewSelectionID === selectionID ? {...task, PreviewRunID: run.ID, PreviewExpiresAt: run.ExpiresAt} : task)}));
            setStartedRun({selectionID, id: run.ID, replaces: challenge?.PreviewRunID, expiresAt: run.ExpiresAt});
            onRejected?.();
        }
        catch (failure) {if (currentSession()) setStartError(failure);}
        finally {if (currentSession()) setStarting(false);}
    };
    return <dialog key={opening === "preparing" ? "preparing" : "shown"} ref={ref} className="ib-cmodal" role="dialog" aria-modal="true" aria-labelledby={`${id}-t`}
        onClose={event => {
            // React re-dispatches a nested dialog's close (the hint confirm) here; only our own counts.
            if (event.target !== ref.current) return;
            releaseDialogLayer();
            onClose();
            if (opener.current instanceof HTMLElement && opener.current.isConnected) opener.current.focus();
        }}
        onCancel={event => {if (event.target !== ref.current) return; event.preventDefault(); ref.current?.close();}}
        onClick={event => {
            if (event.target !== ref.current) return;
            const box = ref.current.getBoundingClientRect();
            if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) ref.current.close();
        }}>
        {challenge && opening !== "preparing" && <>
            <header className="ib-cmodal__head">
                <h2 className="ib-cmodal__title" id={`${id}-t`} tabIndex={-1} ref={titleRef}>{challenge.Snapshot.name}</h2>
                <p className="ib-cmodal__meta">
                    <span className="ib-num">{pointsLabel(challenge.Points)}</span>
                    {challenge.Infrastructure && <span className="ib-tag event-cmodal__lab-tag" aria-label={t("challenges.modal.lab")} title={t("challenges.modal.lab")}><Network aria-hidden="true" /><span>{t("challenges.modal.lab")}</span></span>}
                    {showDifficulty && <span className="ib-tag">{difficultyLabel(challenge.Snapshot.difficulty)}</span>}
                    {solved && <span className="ib-tag ib-tag--ok">{ICON.check}{t("challenges.modal.solved")}</span>}
                    {practiceSolved && <span className="ib-tag ib-tag--ok">{ICON.check}{t("challenges.tile.practice")}</span>}
                    {stageClosed && <span className="ib-tag">{t("challenges.modal.closedTag")}</span>}
                    {challenge.ContentUpdatedAt && <span className="ib-tag">{t("challenges.modal.updatedAt", {time: formatClock(challenge.ContentUpdatedAt)})}</span>}
                    {moderatorPresentation && challenge.BoardPublished === false && <span className="ib-tag ib-tag--warn">{t("challenges.modal.unpublished")}</span>}
                </p>
                <button type="button" className="ib-icon-btn ib-cmodal__close" aria-label={t("common.close")} onClick={() => ref.current?.close()}>{ICON.x}</button>
            </header>
            {!showTask && <div className="ib-cmodal__body">
                {noPreviewRun && <section className="ib-cmodal__blk">
                    <h3>{t("challenges.lab.environment")}</h3>
                    {challenge.PreviewCanStart === true ? <div className="event-cmodal__start">
                        {lengthChoices && <label className="event-cmodal__length"><span>{t("lab.preview.length")}</span>
                            <EventSelect ariaLabel={t("lab.preview.length")} value={String(runLength)} disabled={starting}
                                options={lengthChoices.AllowedMinutes.map(minutes => ({value: String(minutes), label: minutes % 60 === 0 ? t("lab.preview.duration.hours", {n: minutes / 60}) : t("lab.preview.duration.minutes", {n: minutes})}))}
                                onValueChange={value => setChosenLength(Number(value))} /></label>}
                        <EventButton className="ib-btn ib-btn--primary" busy={starting} busyLabel={t("common.busy.starting")} onClick={() => void start()}>{t("participantPreview.lab.start")}</EventButton>
                    </div> : <EmptyState compact message={t("participantPreview.lab.unavailable")} />}
                    {startError instanceof ParticipantChallengeError && startError.code === TEST_LAB_LIMIT && runningTestLabs(startError.context).length > 0
                        ? <TestLabLimit eventID={eventID} labs={runningTestLabs(startError.context)} onStopped={() => {setStartError(undefined); void start();}} />
                        : !!startError && <EventLoadError error={startError} message={startError instanceof ParticipantChallengeError ? (startError.code !== undefined && PREVIEW_NO_FREE_RESOURCES.has(startError.code) ? t("lab.preview.noFreeResources") : apiErrorMessage(startError.code, t("participantPreview.lab.startFailed"))) : t("participantPreview.lab.startFailed")} onRetry={() => void start()} />}
                </section>}
                {!noPreviewRun && <EventLoadError compact error={runtimeFailure} message={t("challenges.lab.unavailable")} onRetry={() => void retryRuntime()} />}
            </div>}
            {showTask && <>
            <div className="ib-tabs ib-cmodal__tabs" role="tablist" aria-label={t("challenges.modal.sections")} data-pointer={pointer || undefined}
                onPointerDown={() => setPointer(true)} onKeyDownCapture={() => setPointer(false)}>
                <button type="button" role="tab" id={`${id}-tab1`} ref={taskTabRef} aria-controls={`${id}-p1`} aria-selected={tab === "task"} tabIndex={tab === "task" ? 0 : -1} onClick={() => setTab("task")}
                    onKeyDown={event => { if (solvesVisible && ["ArrowRight", "ArrowLeft", "End"].includes(event.key)) { event.preventDefault(); setTab("solves"); solvesTabRef.current?.focus(); } }}>{t("challenges.modal.taskTab")}</button>
                {solvesVisible && <button type="button" role="tab" id={`${id}-tab2`} ref={solvesTabRef} aria-controls={`${id}-p2`} aria-selected={tab === "solves"} tabIndex={tab === "solves" ? 0 : -1} onClick={() => setTab("solves")}
                    onKeyDown={event => { if (["ArrowRight", "ArrowLeft", "Home"].includes(event.key)) { event.preventDefault(); setTab("task"); taskTabRef.current?.focus(); } }}>{challenge.SolveCount !== null ? t("challenges.modal.solvesTabCount", {count: challenge.SolveCount}) : t("challenges.modal.solvesTab")}</button>}
            </div>
            <div className="ib-cmodal__task-pane" id={`${id}-p1`} role="tabpanel" aria-labelledby={`${id}-tab1`} hidden={tab !== "task"}>
            <div className="ib-cmodal__body">
                <div className="ib-cmodal__desc">{richTextHasContent(challenge.Snapshot.description) ? <EventRichTextView value={challenge.Snapshot.description} variables={values.variables} links={values.links} openVariables={openVariables} /> : <p>{t("challenges.modal.noDescription")}</p>}</div>
                {challenge.Infrastructure && vpn.available && vpn.connected !== true && <p className="event-cmodal__vpn">{t("challenges.modal.vpnFirst")} <EventButton className="ib-btn ib-btn--sm" onClick={vpn.openVpn}>{t("challenges.modal.vpnOpen")}</EventButton></p>}
                {challenge.Infrastructure && (!isPreview || previewRunStarted) && (!moderators || isPreview) && <ChallengeLabStatus lab={runtime} lifecycle={effectiveLifecycle} withdrawn={runtimeWithdrawn} error={runtimeFailure} onRetry={() => void lab.refetch()} />}
                {labLink.state.status === "error" && <EventLoadError compact className="event-cmodal__lab-error" error={labLink.state.error} message={labLinkErrorMessage(labLink.state.error)} onRetry={labLink.retry} />}
                {challenge.Infrastructure && (!isPreview || previewRunStarted) && (!moderators || isPreview) && effectiveLifecycle && !runtimeWithdrawn && !preview.active && <LabControls key={effectiveLifecycle.ID} eventID={eventID} lab={effectiveLifecycle} onRefresh={() => void lab.refetch()} />}
                {moderatorPresentation && <ModeratorsBlock lab={runtime} lifecycle={effectiveLifecycle ?? null} infrastructure={!!challenge.Infrastructure} />}
                {files.length > 0 && <section className="ib-cmodal__blk">
                    <h3>{t("challenges.modal.files")}</h3>
                    <ul className="ib-cmodal__files">{files.map(file => <li key={file.FileID}>
                        <AttachmentDownload key={file.FileID} url={fileUrl(file.FileID)} name={file.Name} size={file.Size} />
                    </li>)}</ul>
                </section>}


                {hints.length > 0 && <HintsBlock key={challenge.EventChallengeID} challenge={{...challenge, Hints: hints}} eventID={eventID} moderators={moderators} teamMode={teamMode} previewMode={isPreview} chargeMode={hintChargeMode} closed={stageClosed} variables={values.variables} links={values.links} openVariables={openVariables} onUnlocked={() => onHintUnlocked?.()} onRuntimeRetry={() => void lab.refetch()} runtimeUnavailable={runtimeWithdrawn || !!effectiveLifecycle?.LogicalClosed || runtimeEnded || unavailable} />}
                {stageClosed && <p className="event-cmodal__closed" role="status">{t("challenges.modal.stageClosed")}</p>}
                {practice && !solved && <p className="ib-cmodal__hint event-cmodal__note" role="status">{t("challenges.modal.practiceNote")}</p>}
                {(solved || practiceSolved || accepted) && <SolvedPanel challenge={challenge} practice={practiceSolved || (accepted && practiceAnswer)} at={challenge.SolvedAt ?? new Date(now).toISOString()} />}
                {!solved && finished && !moderators && <p className="event-cmodal__closed" role="status">{richMessage(t("challenges.modal.finished"), {strong: <b>{t("challenges.modal.finishedStrong")}</b>})}</p>}
            </div>
                {!solved && !accepted && !practiceSolved && (moderators || (!finished && !stageClosed)) && <form className="ib-cmodal__flag" noValidate onSubmit={event => void submit(event)}>
                    <label htmlFor={`${id}-flag`}>{t("challenges.modal.flag")}</label>
                    <div className="ib-cmodal__row">
                        <div className="ib-cmodal__field">
                            <input ref={flagRef} className="ib-input ib-input--mono" id={`${id}-flag`} name="flag" placeholder="ICE{…}" autoComplete="off" spellCheck={false}
                                aria-describedby={`${id}-msg`} aria-invalid={message?.tone === "error"} value={answer} disabled={exhausted}
                                onChange={event => { setAnswer(event.target.value); if (message?.tone === "error" || message?.retry) setMessage(null); if (moderators) setAccepted(false); }} />
                            {/* Under the field, never under the button. While waiting, the visible countdown ticks silently; one status announces the full wait once. */}
                            <p className={`ib-cmodal__msg${waiting ? " is-warn" : message ? ` is-${message.tone}` : ""}`} id={`${id}-msg`} role={waiting ? undefined : "alert"}>
                                {waiting ? <span aria-hidden="true">{t("challenges.modal.rateLimited", {seconds: waitSeconds})}</span> : exhausted ? t("challenges.modal.attemptsExhausted") : message?.text}
                            </p>
                        </div>
                        <EventButton className="ib-btn ib-btn--primary" type="submit" disabled={waiting || exhausted} busy={busy} busyLabel={t("common.busy.checking")}>{t("challenges.modal.submit")}</EventButton>
                    </div>
                    {!waiting && !exhausted && message?.retry && <EventButton className="ib-btn ib-btn--sm" onClick={() => void send()}>{t("error.overloaded.retry")}</EventButton>}
                    {waiting && <span className="ib-sr" role="status">{t("challenges.modal.rateLimited", {seconds: waitTotal})}</span>}
                    {left !== null && left > 0 && <p className="ib-cmodal__hint" id={`${id}-left`}>{t("challenges.modal.attemptsLeft", {count: left})}</p>}
                </form>}
            </div>
            {solvesVisible && <div className="ib-cmodal__body ib-cmodal__body--solves" id={`${id}-p2`} role="tabpanel" aria-labelledby={`${id}-tab2`} hidden={tab !== "solves"}>
                {tab === "solves" && <ChallengeSolvesTab key={challenge.EventChallengeID} eventID={eventID} challengeID={challenge.EventChallengeID} moderators={moderators} previewTask={isPreview ? challenge : undefined} enabled />}
            </div>}
            </>}
        </>}
    </dialog>;
}
