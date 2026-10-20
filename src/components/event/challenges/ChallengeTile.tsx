import type {CSSProperties} from "react";
import {Lock, Network, RefreshCw} from "lucide-react";
import type {OwnChallenge} from "@/api/participantChallenges";
import {t} from "@/i18n/t";
import {awardedPoints, difficultyLabel, formatClock, lockedLabel} from "./challengeBoardModel";
import {pointsLabel} from "./hintModel";
import {BusyMark} from "@/components/ui/EventButton";
import {EventTooltip} from "@/components/ui/EventTooltip";

const CHECK = <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;

export function ChallengeTile({challenge, showDifficulty = true, accepted = false, onOpen}: {
    challenge: OwnChallenge;
    showDifficulty?: boolean;
    accepted?: boolean;
    onOpen: (challenge: OwnChallenge, tile: HTMLButtonElement) => void;
}) {
    const name = challenge.Snapshot.name;
    const solved = !!challenge.SolvedAt;
    const practice = challenge.Practice && !solved;
    const closed = challenge.Closed;
    const updated = challenge.ContentUpdatedAt ? formatClock(challenge.ContentUpdatedAt) : "";
    const points = solved ? `+${awardedPoints(challenge)}` : String(challenge.Points);
    const scoreStyle = {"--ib-tile-score-scale": Math.min(1, 4 / points.length)} as CSSProperties;
    const context = <>
        {challenge.Infrastructure && <EventTooltip content={t("challenges.modal.lab")} silent>{() => <span className="ib-tile__lab" role="img" aria-label={t("challenges.modal.lab")}><Network aria-hidden="true" /></span>}</EventTooltip>}
        {showDifficulty && <span className="ib-tile__difficulty">{difficultyLabel(challenge.Snapshot.difficulty)}</span>}
    </>;
    const label = challenge.Locked ? lockedLabel(challenge) : "";
    const hasMetadata = !!(challenge.Infrastructure || showDifficulty || challenge.Locked || solved || practice || closed || updated);
    const classes = ["ib-tile", !hasMetadata && "ib-tile--title-only", challenge.Locked && "is-locked", solved && "is-solved", closed && "is-closed", practice && "is-practice", updated && "is-updated", accepted && "is-accepted"].filter(Boolean).join(" ");
    const card = <button type="button" className={classes} data-challenge-id={challenge.EventChallengeID} title={name} aria-disabled={challenge.Locked || undefined}
        aria-label={[name, pointsLabel(solved ? awardedPoints(challenge) : challenge.Points), challenge.Infrastructure && t("challenges.modal.lab"), showDifficulty && difficultyLabel(challenge.Snapshot.difficulty), label, solved && t("challenges.tile.state.solved"), practice && t("challenges.tile.practice"), closed && t("challenges.tile.state.closed"), updated && t("challenges.tile.state.updated")].filter(Boolean).join(", ")}
        onClick={challenge.Locked ? undefined : event => onOpen(challenge, event.currentTarget)}>
        <span className="ib-tile__main">
            <span className="ib-tile__name">{name}</span>
            {hasMetadata && <span className="ib-tile__foot">
                {context}
                {challenge.Locked ? <span className="ib-tile__lock">{challenge.LockedBusy ? <BusyMark /> : <Lock aria-hidden="true" />}{label}</span> : <>
                    {updated && <EventTooltip content={t("challenges.modal.updatedAt", {time: updated})} silent>{() => <span className="ib-tile__upd"><RefreshCw aria-hidden="true" /><span className="ib-sr">{t("challenges.tile.updated")}</span></span>}</EventTooltip>}
                    {closed && <span className="ib-tile__closed">{t("challenges.tile.closed")}</span>}
                    {practice && <EventTooltip content={t("challenges.tile.practice")} silent truncated>{() => <span className="ib-tile__practice">{CHECK}{t("challenges.tile.practice")}</span>}</EventTooltip>}
                    <span className="ib-tile__solved">{CHECK}<span className="ib-tile__solved-t">{t("challenges.tile.solved")}</span></span>
                </>}
            </span>}
        </span>
        <span className="ib-tile__pts" style={scoreStyle}>{points}</span>
    </button>;
    return challenge.Locked ? <EventTooltip content={label} className="ib-tile-tip" silent>{() => card}</EventTooltip> : card;
}
