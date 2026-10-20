"use client";

import {Check} from "lucide-react";
import {EmptyState} from "@/components/ui/EmptyState";
import type {OwnChallenge} from "@/api/participantChallenges";
import {ChallengeTile} from "./ChallengeTile";
import {t} from "@/i18n/t";
import {awardedPoints, formatPoints, solvedCount, type BoardGroup} from "./challengeBoardModel";
import {EventTooltip} from "@/components/ui/EventTooltip";

type BoardProps = {groups: (BoardGroup & {visible: OwnChallenge[]})[]; acceptedID: string | null; showDifficulty: boolean; onOpen: (challenge: OwnChallenge, tile: HTMLButtonElement) => void; toolbar?: React.ReactNode; emptyMessage: string; onResetFilters?: () => void};

export function TilesBoard({groups, acceptedID, showDifficulty, onOpen, toolbar, emptyMessage, onResetFilters}: BoardProps) {
    return <div className="ib-board event-board">
        <div className="ib-board__bar">{toolbar}</div>
        <div className="ib-board__body">
            {groups.map(item => <section key={item.key} className={`ib-board__sec${item.visible.length ? "" : " is-done"}`} aria-label={item.name}>
                <header className="ib-board__cat">
                    {!item.visible.length && <Check size={14} aria-hidden="true" />}
                    <EventTooltip truncated placement="bottom" content={item.name}>{() => <h3>{item.name}</h3>}</EventTooltip>
                    <span className="ib-board__count">{solvedCount(item.challenges)}</span>
                    {item.visible.length > 0 && <span className="ib-board__rest ib-num">{formatPoints(item.challenges.filter(task => task.SolvedAt && !task.Practice).reduce((sum, task) => sum + awardedPoints(task), 0))} / {formatPoints(item.challenges.reduce((sum, task) => sum + task.Points, 0))}</span>}
                </header>
                {item.visible.length > 0 && <div className="ib-tiles">{item.visible.map(challenge => <ChallengeTile key={challenge.EventChallengeID} challenge={challenge} showDifficulty={showDifficulty} accepted={acceptedID === challenge.EventChallengeID} onOpen={onOpen} />)}</div>}
            </section>)}
            {!groups.length && <div className="ib-board__state"><EmptyState message={emptyMessage} />{onResetFilters && <button type="button" className="ib-btn ib-btn--sm" onClick={onResetFilters}>{t("challenges.filter.reset")}</button>}</div>}
        </div>
    </div>;
}
