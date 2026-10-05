import {Lock} from "lucide-react";
import type {OwnChallenge} from "@/api/participantChallenges";
import {t} from "@/i18n/t";
import {formatClock, lockedLabel} from "./challengeBoardModel";
import {pointsLabel} from "./hintModel";
import {EventTooltip} from "@/components/ui/EventTooltip";

const CHECK = <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;

// React port of ds-v2 IB.ChallengeTile (components/challenge-tile). A locked
// tile (unsolved prerequisites) is a local extension: it never opens.
export function ChallengeTile({challenge, lg = false, accepted = false, onOpen}: {
    challenge: OwnChallenge;
    lg?: boolean;
    accepted?: boolean;
    onOpen: (challenge: OwnChallenge, tile: HTMLButtonElement) => void;
}) {
    const name = challenge.Snapshot.name;
    const size = lg ? " ib-tile--lg" : "";
    if (challenge.Locked) {
        const label = lockedLabel(challenge);
        return <EventTooltip content={label} className="ib-tile-tip" silent>{() => <button type="button" className={`ib-tile is-locked${size}`} aria-disabled="true" data-challenge-id={challenge.EventChallengeID} aria-label={[name, pointsLabel(challenge.Points), label].join(", ")}>
            <span className="ib-tile__name">{name}</span>
            <span className="ib-tile__foot"><span className="ib-tile__lock"><Lock aria-hidden="true" />{label}</span></span>
        </button>}</EventTooltip>;
    }
    const solved = !!challenge.SolvedAt;
    const practice = challenge.Practice && !solved;
    const closed = challenge.Closed;
    const updated = challenge.ContentUpdatedAt ? formatClock(challenge.ContentUpdatedAt) : "";
    const classes = ["ib-tile", size.trim(), solved && "is-solved", closed && "is-closed", practice && "is-practice", updated && "is-updated", accepted && "is-accepted"].filter(Boolean).join(" ");
    return <button type="button" className={classes} data-challenge-id={challenge.EventChallengeID}
        aria-label={[name, pointsLabel(challenge.Points), solved && t("challenges.tile.state.solved"), practice && t("challenges.tile.practice"), closed && t("challenges.tile.state.closed"), updated && t("challenges.tile.state.updated")].filter(Boolean).join(", ")}
        onClick={event => onOpen(challenge, event.currentTarget)}>
        <span className="ib-tile__name">{name}</span>
        <span className="ib-tile__foot">
            <span className="ib-tile__pts">{challenge.Points}</span>
            {updated && <span className="ib-tile__upd">{t("challenges.tile.updated")}</span>}
            {closed && <span className="ib-tile__closed">{t("challenges.tile.closed")}</span>}
            {practice && <EventTooltip content={t("challenges.tile.practice")} silent truncated>{() => <span className="ib-tile__practice">{CHECK}{t("challenges.tile.practice")}</span>}</EventTooltip>}
            <span className="ib-tile__solved">{CHECK}<span className="ib-tile__solved-t">{t("challenges.tile.solved")}</span></span>
        </span>
    </button>;
}
