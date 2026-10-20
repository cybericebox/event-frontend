import type {CSSProperties} from "react";
import {Network} from "lucide-react";
import type {OwnChallenge} from "@/api/participantChallenges";
import {EventBrandLogo} from "@/components/event/EventBrandLogo";
import {EventTooltip} from "@/components/ui/EventTooltip";
import {t} from "@/i18n/t";
import {awardedPoints, difficultyLabel, lockedLabel} from "./challengeBoardModel";
import {pointsLabel} from "./hintModel";

export function ChallengeTile({challenge, showDifficulty = true, accepted = false, onOpen}: {
    challenge: OwnChallenge;
    showDifficulty?: boolean;
    accepted?: boolean;
    onOpen: (challenge: OwnChallenge, tile: HTMLButtonElement) => void;
}) {
    const name = challenge.Snapshot.name;
    const solved = !!challenge.SolvedAt;
    const practice = challenge.Practice && !solved;
    const loading = !!challenge.LockedBusy;
    const unavailable = !solved && (challenge.Closed || (challenge.Locked && !loading) || practice);
    const points = solved ? `+${awardedPoints(challenge)}` : String(challenge.Points);
    const scoreStyle = {"--ib-tile-score-scale": Math.min(1, 4 / points.length)} as CSSProperties;
    const difficulty = showDifficulty && ["elementary", "trivial", "easy", "medium", "hard", "insane"].includes(challenge.Snapshot.difficulty)
        ? difficultyLabel(challenge.Snapshot.difficulty) : null;
    const label = challenge.Locked ? lockedLabel(challenge) : "";
    const classes = ["ib-tile", !difficulty && "ib-tile--title-only", challenge.Locked && "is-locked", solved && "is-solved", unavailable && "is-closed", loading && "is-loading"].filter(Boolean).join(" ");
    return <EventTooltip content={name} className="ib-tile-tip" floating silent>{() => <button type="button" className={classes} data-challenge-id={challenge.EventChallengeID} data-accepted={accepted || undefined} aria-disabled={challenge.Locked || undefined} aria-busy={loading || undefined}
        aria-label={[name, pointsLabel(solved ? awardedPoints(challenge) : challenge.Points), challenge.Infrastructure && t("challenges.modal.lab"), difficulty, label, solved && t("challenges.tile.state.solved"), practice && t("challenges.tile.practice"), challenge.Closed && t("challenges.tile.state.closed"), challenge.ContentUpdatedAt && t("challenges.tile.state.updated")].filter(Boolean).join(", ")}
        onClick={challenge.Locked ? undefined : event => onOpen(challenge, event.currentTarget)}>
        <span className="ib-tile__main">
            <span className="ib-tile__name">{name}</span>
            {difficulty && <span className="ib-tile__difficulty">{difficulty}</span>}
        </span>
        <span className="ib-tile__score">
            {challenge.Infrastructure && <EventTooltip content={t("challenges.modal.lab")} className="ib-tile__lab-tip" floating silent>{() => <span className="ib-tile__lab" role="img" aria-label={t("challenges.modal.lab")}><Network aria-hidden="true" /></span>}</EventTooltip>}
            <span className="ib-tile__pts" style={scoreStyle}>{points}</span>
        </span>
        {loading && <span className="ib-tile__loading" aria-hidden="true"><EventBrandLogo className="ib-tile__loading-logo" size={32} /></span>}
    </button>}</EventTooltip>;
}
