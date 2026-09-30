"use client";

import type {ParticipationMember} from "@/api/participationStats";
import {TeamRole, type TeamMember} from "@/api/eventTeams";
import type {PublicEventInfo} from "@/api/publicEventInfo";
import {t} from "@/i18n/t";
import {BlockStates, Card, formatNumber} from "./participationBlocks";
import {shortTime} from "./participationStatsModel";

export type MemberRow = {member: TeamMember; stats: ParticipationMember | undefined};

// The roster joined with each member's results; members with points first, invitees who have not accepted yet last.
export function memberRows(roster: readonly TeamMember[], stats: readonly ParticipationMember[]): MemberRow[] {
    const byUser = new Map(stats.map(item => [item.UserID, item]));
    return roster.map(member => ({member, stats: byUser.get(member.UserID)}))
        .sort((a, b) => Number(a.member.Pending) - Number(b.member.Pending) || (b.stats?.Points ?? 0) - (a.stats?.Points ?? 0) || a.member.DisplayName.localeCompare(b.member.DisplayName, "uk"));
}

export function MembersCard({event, roster, error, onRetry, stats, actions, rosterLine, roleLabels}: {
    event: PublicEventInfo; roster: TeamMember[] | undefined; error?: unknown; onRetry: () => void; stats: readonly ParticipationMember[];
    actions: (member: TeamMember) => React.ReactNode; rosterLine: string; roleLabels?: ReadonlyMap<string, string>;
}) {
    return <Card title={t("participation.team.members")} note={rosterLine} flush>
        {!roster ? <BlockStates state={error ? "error" : "loading"} event={event} loadingLabel={t("participation.team.membersLoading")} errorMessage={t("participation.team.membersFailed")} emptyMessage="" onRetry={onRetry} error={error} height={200} />
            : <div className="event-pp-table__scroll"><table className="event-pp-table"><thead><tr>
                <th>{t("participation.team.member")}</th><th>{t("participation.team.role")}</th>
                <th className="is-num">{t("participation.team.points")}</th><th className="is-num">{t("participation.team.solves")}</th><th className="is-nowrap">{t("participation.team.joined")}</th>
                <th><span className="ib-sr">{t("participation.team.actions")}</span></th>
            </tr></thead><tbody>{memberRows(roster, stats).map(({member, stats: share}) => <tr key={member.UserID} className={member.Own ? "is-own" : undefined}>
                <td>{member.DisplayName}{member.Own && <span className="event-part__muted"> · {t("participation.team.you")}</span>}</td>
                <td>{roleLabels?.has(member.UserID) ? <span className="ib-tag ib-tag--role">{roleLabels.get(member.UserID)}</span> : member.Pending ? <span className="ib-tag ib-tag--warn">{t("participation.team.pending")}</span>
                    : member.Role === TeamRole.Captain ? <span className="ib-tag ib-tag--role">{t("participation.team.captain")}</span> : <span className="event-part__muted">{t("participation.team.member")}</span>}</td>
                <td className="is-num">{share ? formatNumber(share.Points) : "—"}</td>
                <td className="is-num">{share ? formatNumber(share.Solves) : "—"}</td>
                <td className="is-nowrap">{share && !member.Pending ? shortTime(share.JoinedAt) : "—"}</td>
                <td className="is-actions">{actions(member)}</td>
            </tr>)}</tbody></table></div>}
    </Card>;
}
