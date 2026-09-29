import {Lock} from "lucide-react";
import type {OwnChallenge} from "@/api/participantChallenges";
import {formatClock, lockedLabel} from "./challengeBoardModel";

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
        return <button type="button" className={`ib-tile is-locked${size}`} aria-disabled="true" data-challenge-id={challenge.EventChallengeID} aria-label={`${name}, ${challenge.Points} балів, ${label}`} title={label}>
            <span className="ib-tile__name">{name}</span>
            <span className="ib-tile__foot"><span className="ib-tile__lock"><Lock aria-hidden="true" />{label}</span></span>
        </button>;
    }
    const solved = !!challenge.SolvedAt;
    const updated = challenge.ContentUpdatedAt ? formatClock(challenge.ContentUpdatedAt) : "";
    const classes = ["ib-tile", size.trim(), solved && "is-solved", updated && "is-updated", accepted && "is-accepted"].filter(Boolean).join(" ");
    return <button type="button" className={classes} data-challenge-id={challenge.EventChallengeID}
        aria-label={`${name}, ${challenge.Points} балів${solved ? ", розвʼязано" : ""}${updated ? ", оновлено" : ""}`}
        onClick={event => onOpen(challenge, event.currentTarget)}>
        <span className="ib-tile__name">{name}</span>
        <span className="ib-tile__foot">
            <span className="ib-tile__pts">{challenge.Points}</span>
            {updated && <span className="ib-tile__upd">Оновлено</span>}
            <span className="ib-tile__solved">{CHECK}<span className="ib-tile__solved-t">Розвʼязано</span></span>
        </span>
    </button>;
}
