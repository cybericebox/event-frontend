"use client";

import {useEffect, useId, useRef, useState, type FormEvent} from "react";
import {ChallengeSolvesTab} from "./ChallengeSolvesTab";
import {labLinkErrorMessage, useLabLink, type LabLinkState} from "./useLabLink";
import {EventLoadError} from "@/components/event/EventLoadError";
import {useQuery} from "@tanstack/react-query";
import {Network} from "lucide-react";
import {ApiErrorCode} from "@/api/apiErrors";
import {
    challengeAttachmentUrl, challengeFiles, getOwnChallengeLab, ParticipantChallengeError, submitChallenge, unlockChallengeHint,
    type ChallengeHint, type OwnChallenge,
} from "@/api/participantChallenges";
import {reportTaskOpened} from "@/api/taskOpenedBeacon";
import {moderatorFileUrl, submitModeratorFlag} from "@/api/moderatorsBoard";
import {getModeratorChallengeLab, type LabRuntime} from "@/api/manageLabs";
import {EventRichTextView} from "@/components/event/content/EventRichTextView";
import {richTextHasContent} from "@/components/event/content/richTextState";
import {useEventVpn} from "@/components/event/vpn/EventVpn";
import {difficultyLabel, formatClock, formatFileSize, solvesLabel} from "./challengeBoardModel";
import {t} from "@/i18n/t";
import {richMessage} from "./richMessage";
import {hintConfirmText, hintCostLabel, hintDocument, hintLevelLabel, hintModeNote, hintNeedsConfirm, hintUnlockError, pointsLabel, type HintChargeMode} from "./hintModel";
import {BusyMark, EventButton} from "@/components/ui/EventButton";
import {ConfirmDialog} from "@/components/ui/ConfirmDialog";
import {EventTooltip} from "@/components/ui/EventTooltip";

export type BoardMode = "participant" | "moderators";
type Message = {text: string; tone: "error" | "warn"} | null;

const svg = (path: React.ReactNode) => <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{path}</svg>;
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
        if (error.status === 409 || error.status === 403) return {text: t("challenges.submit.notAccepting"), tone: "warn"};
    }
    return {text: t("challenges.submit.failed"), tone: "warn"};
}

// A web device opens through a fresh short-lived link fetched on click: while it is fetched the row shows the busy mark.
function CopyField({value, onOpen, linkPending = false}: {value: string; onOpen?: () => void; linkPending?: boolean}) {
    const [copied, setCopied] = useState(false);
    return <div className="ib-copy">
        <EventTooltip content={value} className="ib-copy__tip" truncated>{() => <span className="ib-copy__value">{value}</span>}</EventTooltip>
        <button type="button" className={`ib-btn ib-btn--sm ib-copy__btn${copied ? " is-copied" : ""}`} aria-label={t("challenges.copy.aria")} onClick={() => {
            void navigator.clipboard?.writeText(value).then(() => {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1600);
            }).catch(() => {});
        }}>
            <span className="ib-copy__idle">{ICON.copy}{t("challenges.copy.idle")}</span>
            <span className="ib-copy__done">{ICON.check}{t("challenges.copy.done")}</span>
        </button>
        {onOpen && linkPending && <span className="ib-icon-btn ib-icon-btn--sm ib-icon-btn--outline" role="status" aria-label={t("challenges.lab.starting")}><BusyMark /></span>}
        {onOpen && !linkPending && <button type="button" className="ib-icon-btn ib-icon-btn--sm ib-icon-btn--outline" onClick={onOpen} aria-label={t("challenges.host.open")}>{ICON.ext}</button>}
    </div>;
}

function HostBlock({lab, pending, link, busyKey, onOpen, onRetry}: {lab: LabRuntime | undefined; pending: boolean; link: LabLinkState; busyKey: string | null; onOpen: (device: string, port: number) => void; onRetry: () => void}) {
    const access = lab?.Access ?? [];
    const web = access.some(item => /^https?$/i.test(item.Protocol) || !!item.URL);
    return <section className="ib-cmodal__blk">
        <h3>{web ? t("challenges.host.service") : t("challenges.host.connection")}</h3>
        {access.length
            ? <div className="event-cmodal__hosts">{access.map(item => {
                const value = item.URL || (/^tcp$/i.test(item.Protocol) ? `nc ${item.Device} ${item.Port}` : `${item.Device}:${item.Port}`);
                return <CopyField key={`${item.Device}-${item.Port}`} value={value} onOpen={item.URL ? () => onOpen(item.Device, item.Port) : undefined} linkPending={busyKey === `${item.Device}:${item.Port}`} />;
            })}</div>
            : <p className="ib-cmodal__hint">{pending && <BusyMark />}{pending ? t("challenges.host.checking") : t("challenges.host.preparing")}</p>}
        {link.status === "error" && <EventLoadError compact error={link.error} message={labLinkErrorMessage(link.error)} onRetry={onRetry} />}
        <p className="ib-cmodal__hint">{t("challenges.host.viaVpn")}</p>
    </section>;
}

// A hint text renders formatted like the description; plain text from older
// exercises stays a paragraph.
function HintText({text}: {text: string}) {
    const document = hintDocument(text);
    return document ? <div className="ib-cmodal__desc event-cmodal__hint-text"><EventRichTextView value={document} /></div> : <p>{text}</p>;
}

// Hints: participants see each hint's price, never its level (moderators do);
// participants unlock one by one (paid ones after a confirm); the
// moderators board shows every text and never unlocks.
export function HintsBlock({challenge, eventID, moderators, chargeMode, onUnlocked}: {
    challenge: OwnChallenge; eventID: string; moderators: boolean; chargeMode: HintChargeMode; onUnlocked: () => void;
}) {
    const [confirm, setConfirm] = useState<{hint: ChallengeHint; index: number} | null>(null);
    const [busyID, setBusyID] = useState<string | null>(null);
    const [error, setError] = useState("");
    const [confirmError, setConfirmError] = useState("");
    const paid = challenge.Hints.some(hint => hint.Cost > 0);

    async function unlock(hint: ChallengeHint) {
        if (busyID) return;
        setBusyID(hint.ID);
        setError("");
        try {
            await unlockChallengeHint(eventID, challenge.EventChallengeID, hint.ID);
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
        <h3>{t("challenges.hints.title")}</h3>
        {!moderators && (paid || challenge.HintCostTotal > 0) && <p className="ib-cmodal__hint event-cmodal__hint-mode">
            {hintModeNote(chargeMode)}{challenge.HintCostTotal > 0 && <> {richMessage(t("challenges.hints.spent"), {points: <span className="ib-num">{pointsLabel(challenge.HintCostTotal)}</span>})}</>}
        </p>}
        <ul className="event-cmodal__hints">{challenge.Hints.map((hint, index) => <li key={hint.ID}>
            <div className="event-cmodal__hint-head">
                <span className="event-cmodal__hint-title">{moderators ? t("challenges.hints.itemWithLevel", {number: index + 1, level: hintLevelLabel(hint.Level)}) : t("challenges.hints.item", {number: index + 1})}<span className="ib-num"> · {hintCostLabel(hint.Cost)}</span></span>
                {!moderators && !hint.Unlocked && <EventButton className="ib-btn ib-btn--sm" disabled={!!busyID} busy={busyID === hint.ID}
                    onClick={() => {if (hintNeedsConfirm(hint)) {setConfirmError(""); setConfirm({hint, index});} else void unlock(hint);}}>{t("challenges.hints.unlock")}</EventButton>}
            </div>
            {hint.Content && <HintText text={hint.Content} />}
            {hint.Unlocked && hint.UnlockedByName && <p className="ib-cmodal__hint">{t("challenges.hints.unlockedBy", {name: hint.UnlockedByName})}{hint.UnlockedAt && <> · <span className="ib-num">{formatClock(hint.UnlockedAt, true)}</span></>}</p>}
        </li>)}</ul>
        {error && <p className="ib-cmodal__msg is-warn" role="alert">{error}</p>}
        <ConfirmDialog open={!!confirm} onCancel={() => setConfirm(null)} busy={!!busyID} error={confirmError}
            title={confirm ? t("challenges.hints.confirmTitle", {number: confirm.index + 1}) : ""}
            description={confirm ? hintConfirmText(chargeMode, confirm.hint.Cost) : undefined}
            confirmLabel={t("challenges.hints.confirm")} onConfirm={() => confirm && void unlock(confirm.hint)}>
            <p className="ib-cmodal__hint">{t("challenges.hints.teamSees")}</p>
        </ConfirmDialog>
    </section>;
}

// React port of ds-v2 IB.ChallengeModal on a native <dialog>.
export function ChallengeModal({challenge, eventID, mode, teamMode, finished, showDifficulty, showHints, hintChargeMode = "reward", onClose, onAccepted, onHintUnlocked}: {
    challenge: OwnChallenge | null;
    eventID: string;
    mode: BoardMode;
    teamMode: boolean;
    finished: boolean;
    showDifficulty: boolean;
    showHints: boolean;
    hintChargeMode?: HintChargeMode;
    onClose: () => void;
    onAccepted: (challengeID: string) => void;
    onHintUnlocked?: () => void;
}) {
    const ref = useRef<HTMLDialogElement>(null);
    const opener = useRef<Element | null>(null);
    const titleRef = useRef<HTMLHeadingElement>(null);
    const flagRef = useRef<HTMLInputElement>(null);
    const id = useId();
    const vpn = useEventVpn();
    const [tab, setTab] = useState<"task" | "solves">("task");
    const [answer, setAnswer] = useState("");
    const [message, setMessage] = useState<Message>(null);
    const [busy, setBusy] = useState(false);
    const [accepted, setAccepted] = useState(false);
    const [waitUntil, setWaitUntil] = useState(0);
    const [now, setNow] = useState(() => Date.now());
    const challengeID = challenge?.EventChallengeID;
    const moderators = mode === "moderators";

    const lab = useQuery({
        queryKey: ["event-challenge-lab", mode, eventID, challengeID],
        queryFn: () => moderators ? getModeratorChallengeLab(eventID, challengeID!) : getOwnChallengeLab(eventID, challengeID!),
        enabled: !!challenge?.Infrastructure && !challenge.Locked,
        retry: false, refetchInterval: 30000, refetchOnWindowFocus: false,
    });
    // A web device opens through a link fetched on click; the moderators team uses the manage route.
    const labLink = useLabLink(eventID, challengeID, moderators);
    // The moderators board lists its own team's solves; participants see them only when the event shows counts.
    const solvesVisible = moderators || (challenge?.SolveCount !== null && challenge?.SolveCount !== undefined);

    useEffect(() => {
        const dialog = ref.current;
        if (!dialog) return;
        if (challengeID && !dialog.open) {
            opener.current = document.activeElement;
            dialog.showModal();
            (flagRef.current ?? titleRef.current)?.focus();
        } else if (!challengeID && dialog.open) {
            dialog.close();
        }
    }, [challengeID]);

    // Opening an available task tells the analytics; it never blocks the modal.
    const openable = !!challenge && !challenge.Locked;
    useEffect(() => {
        if (moderators || !challengeID || !openable) return;
        reportTaskOpened(eventID, challengeID);
    }, [moderators, eventID, challengeID, openable]);

    // A new challenge starts on its task tab with a clean flag form.
    const [shownID, setShownID] = useState(challengeID);
    if (shownID !== challengeID) {
        setShownID(challengeID);
        setTab("task");
        setAnswer("");
        setMessage(null);
        setAccepted(false);
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
        if (!challenge || busy || waiting) return;
        const value = answer.trim();
        if (!value) {
            setMessage({text: t("challenges.modal.flagEmpty"), tone: "error"});
            flagRef.current?.focus();
            return;
        }
        setBusy(true);
        setMessage(null);
        try {
            const correct = moderators
                ? (await submitModeratorFlag(eventID, challenge.EventChallengeID, value)).Correct
                : (await submitChallenge(eventID, challenge.EventChallengeID, value, crypto.randomUUID())).Correct;
            if (correct) {
                setAccepted(true);
                setAnswer("");
                if (!moderators) {
                    onAccepted(challenge.EventChallengeID);
                    titleRef.current?.focus();
                }
            } else {
                setMessage({text: t("challenges.modal.flagRejected"), tone: "error"});
                flagRef.current?.focus();
            }
        } catch (error) {
            if (error instanceof ParticipantChallengeError && error.status === 429) {
                const seconds = error.retryAfter ?? 30;
                setWaitUntil(Date.now() + seconds * 1000);
                setNow(Date.now());
                setMessage(null);
            } else {
                setMessage(submitMessage(error));
            }
        } finally {
            setBusy(false);
        }
    }

    const files = challenge ? challengeFiles(challenge) : [];
    const solved = !!challenge?.SolvedAt;
    const category = challenge?.GroupName || t("challenges.otherCategory");
    const hints = showHints && challenge?.HintsEnabled ? challenge.Hints : [];
    const fileUrl = (fileID: string) => moderators ? moderatorFileUrl(eventID, challengeID!, fileID) : challengeAttachmentUrl(eventID, challengeID!, fileID);

    return <dialog ref={ref} className="ib-cmodal" aria-labelledby={`${id}-t`}
        onClose={event => {
            // React re-dispatches a nested dialog's close (the hint confirm) here; only our own counts.
            if (event.target !== ref.current) return;
            onClose();
            if (opener.current instanceof HTMLElement && opener.current.isConnected) opener.current.focus();
        }}
        onClick={event => {
            if (event.target !== ref.current) return;
            const box = ref.current.getBoundingClientRect();
            if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) ref.current.close();
        }}>
        {challenge && <>
            <header className="ib-cmodal__head">
                <p className="ib-cmodal__meta">
                    <EventTooltip truncated placement="bottom" className="ib-cmodal__cat" content={category}>{() => <span>{category}</span>}</EventTooltip><span aria-hidden="true">·</span>
                    <span className="ib-num">{pointsLabel(challenge.Points)}</span>
                    {showDifficulty && <span className="ib-tag">{difficultyLabel(challenge.Snapshot.difficulty)}</span>}
                    {solved && <span className="ib-tag ib-tag--ok">{ICON.check}{t("challenges.modal.solved")}</span>}
                    {challenge.ContentUpdatedAt && <span className="ib-tag">{t("challenges.modal.updatedAt", {time: formatClock(challenge.ContentUpdatedAt)})}</span>}
                    {moderators && challenge.BoardPublished === false && <span className="ib-tag ib-tag--warn">{t("challenges.modal.unpublished")}</span>}
                    {challenge.Infrastructure && vpn.available && <button type="button" className="ib-tag event-vpn-badge" onClick={vpn.openVpn}><Network aria-hidden="true" />{t("challenges.modal.vpnRequired")}</button>}
                </p>
                <h2 className="ib-cmodal__title" id={`${id}-t`} tabIndex={-1} ref={titleRef}>{challenge.Snapshot.name}</h2>
                <button type="button" className="ib-icon-btn ib-cmodal__close" aria-label={t("common.close")} onClick={() => ref.current?.close()}>{ICON.x}</button>
            </header>
            <div className="ib-tabs ib-cmodal__tabs" role="tablist" aria-label={t("challenges.modal.sections")}>
                <button type="button" role="tab" id={`${id}-tab1`} aria-controls={`${id}-p1`} aria-selected={tab === "task"} tabIndex={tab === "task" ? 0 : -1} onClick={() => setTab("task")}
                    onKeyDown={event => { if (solvesVisible && ["ArrowRight", "ArrowLeft", "End"].includes(event.key)) { event.preventDefault(); setTab("solves"); } }}>{t("challenges.modal.taskTab")}</button>
                {solvesVisible && <button type="button" role="tab" id={`${id}-tab2`} aria-controls={`${id}-p2`} aria-selected={tab === "solves"} tabIndex={tab === "solves" ? 0 : -1} onClick={() => setTab("solves")}
                    onKeyDown={event => { if (["ArrowRight", "ArrowLeft", "Home"].includes(event.key)) { event.preventDefault(); setTab("task"); } }}>{challenge.SolveCount !== null ? solvesLabel(challenge.SolveCount) : t("challenges.modal.solvesTab")}</button>}
            </div>
            <div className="ib-cmodal__body" id={`${id}-p1`} role="tabpanel" aria-labelledby={`${id}-tab1`} hidden={tab !== "task"}>
                <div className="ib-cmodal__desc">{richTextHasContent(challenge.Snapshot.description) ? <EventRichTextView value={challenge.Snapshot.description} /> : <p>{t("challenges.modal.noDescription")}</p>}</div>
                {files.length > 0 && <section className="ib-cmodal__blk">
                    <h3>{t("challenges.modal.files")}</h3>
                    <ul className="ib-cmodal__files">{files.map(file => <li key={file.FileID}>
                        <a className="ib-cmodal__file" href={fileUrl(file.FileID)} download={file.Name}>{ICON.dl}{file.Name}<span className="ib-cmodal__size">{formatFileSize(file.Size)}</span></a>
                    </li>)}</ul>
                </section>}
                {challenge.Infrastructure && <HostBlock lab={lab.data} pending={lab.isPending} link={labLink.state} busyKey={labLink.busyKey} onOpen={labLink.open} onRetry={labLink.retry} />}
                {hints.length > 0 && <HintsBlock key={challenge.EventChallengeID} challenge={challenge} eventID={eventID} moderators={moderators} chargeMode={hintChargeMode} onUnlocked={() => onHintUnlocked?.()} />}
                {moderators && <p className="ib-cmodal__hint event-cmodal__note">{t("challenges.modal.moderatorsNote")}</p>}
                {accepted && <div className="ib-cmodal__ok" role="status">{ICON.check}{moderators ? t("challenges.modal.flagCorrect") : t("challenges.modal.flagAccepted")}{!moderators && <span className="ib-num">+{challenge.Points}</span>}</div>}
                {!accepted && solved && !moderators && <div className="ib-cmodal__ok" role="status">{ICON.check}{teamMode ? t("challenges.modal.solvedByTeam") : t("challenges.modal.solved")}<span className="ib-num">{formatClock(challenge.SolvedAt!, true)}</span></div>}
                {!solved && finished && !moderators && <p className="event-cmodal__closed" role="status">{richMessage(t("challenges.modal.finished"), {strong: <b>{t("challenges.modal.finishedStrong")}</b>})}</p>}
                {(moderators || (!solved && !finished && !accepted)) && <form className="ib-cmodal__flag" noValidate onSubmit={event => void submit(event)}>
                    <label htmlFor={`${id}-flag`}>{t("challenges.modal.flag")}</label>
                    <div className="ib-cmodal__row">
                        <input ref={flagRef} className="ib-input ib-input--mono" id={`${id}-flag`} name="flag" placeholder="ICE{…}" autoComplete="off" spellCheck={false}
                            aria-describedby={`${id}-msg`} aria-invalid={message?.tone === "error"} value={answer}
                            onChange={event => { setAnswer(event.target.value); if (message?.tone === "error") setMessage(null); if (moderators) setAccepted(false); }} />
                        <EventButton className="ib-btn ib-btn--primary" type="submit" disabled={waiting} busy={busy}>{t("challenges.modal.submit")}</EventButton>
                    </div>
                    <p className={`ib-cmodal__msg${waiting ? " is-warn" : message ? ` is-${message.tone}` : ""}`} id={`${id}-msg`} role="alert">
                        {waiting ? t("challenges.modal.rateLimited", {seconds: waitSeconds}) : message?.text}
                    </p>
                </form>}
            </div>
            {solvesVisible && <div className="ib-cmodal__body ib-cmodal__body--solves" id={`${id}-p2`} role="tabpanel" aria-labelledby={`${id}-tab2`} hidden={tab !== "solves"}>
                {tab === "solves" && <ChallengeSolvesTab key={challenge.EventChallengeID} eventID={eventID} challengeID={challenge.EventChallengeID} moderators={moderators} enabled />}
            </div>}
        </>}
    </dialog>;
}
