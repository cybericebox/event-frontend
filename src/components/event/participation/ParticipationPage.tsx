"use client";

import {useState} from "react";
import Link from "next/link";
import {useQuery} from "@tanstack/react-query";
import {EmptyState} from "@/components/ui/EmptyState";
import {getOwnParticipantAnswers} from "@/api/participantForm";
import {useGuestEvent} from "@/components/event/GuestShell";
import {useParticipantContext} from "@/components/event/ParticipantShell";
import {useStaffAccess} from "@/components/event/useStaffAccess";
import {EventLoading} from "@/components/event/EventLoading";
import {t} from "@/i18n/t";
import {defaultParticipationTab, participationTabFromParam, participationTabHref, type ParticipationTab} from "./participationModel";
import {useLinkCode} from "./participationParts";
import {ProfileTab} from "./ProfileTab";
import {useParticipationStats} from "./useParticipationStats";
import {TeamTab} from "./TeamPage";
import {getOwnTeamMembers, TeamRole} from "@/api/eventTeams";

function Heading({sub}: {sub?: string}) {
    return <header className="ib-page-header"><div className="ib-page-header__top"><div className="ib-page-header__heading">
        <h1 className="ib-page-header__title">{t("participation.title")}</h1>
        {sub && <p className="ib-page-header__sub">{sub}</p>}
    </div></div></header>;
}

// «Моя участь»: the profile and, in team mode, the team as two tabs (?tab=team is deep-linkable).
export function ParticipationPage() {
    const access = useParticipantContext();
    const guest = useGuestEvent();
    const staff = useStaffAccess(guest?.EventID);
    const linkCode = useLinkCode();
    const [now] = useState(() => Date.now());
    const [selected, setSelected] = useState<string | null>(() => typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("tab"));
    const event = access?.event ?? guest;
    const teamMode = event?.Participation === 1;
    const info = access?.participantInfo;
    const team = access?.ownTeam ?? null;
    const previewing = !access && staff.staff;
    // The moderators team is always a team, so organizers get both tabs in every mode.
    const tabbed = !!teamMode || previewing;
    const explicit = participationTabFromParam(selected, tabbed);
    const previewStats = useParticipationStats(event?.EventID, {preview: previewing, enabled: previewing});
    const captain = !!team && team.Role === TeamRole.Captain;
    // The captain's default tab depends on pending invitations, so it waits for the roster.
    const members = useQuery({queryKey: ["event-team-members", event?.EventID, team?.ID], queryFn: () => getOwnTeamMembers(event!.EventID), enabled: !!event && !!team && captain && !explicit, retry: false, refetchOnWindowFocus: false});
    const answers = useQuery({queryKey: ["event-own-answers", event?.EventID], queryFn: () => getOwnParticipantAnswers(), enabled: !!access, retry: false, refetchOnWindowFocus: false});
    if (!event) return <EventLoading label={t("participation.loading")} />;
    if (!access && !previewing) {
        if (staff.pending) return <EventLoading label={t("participation.loading")} />;
        return <div className="event-participation">
            <Heading />
            <EmptyState message={linkCode ? t("participation.team.linkRegister") : t("participation.unavailable")} action={<Link className="ib-btn ib-btn--primary" href="/join">{linkCode ? t("shell.join.action") : t("participation.noTeam.join")}</Link>} />
        </div>;
    }
    if (previewing && previewStats.unavailable) return <div className="event-participation"><Heading /><EmptyState message={t("participation.preview.noModerators")} /></div>;
    if (access && !info) return <EventLoading label={t("participation.loading")} />;
    if (!explicit && captain && members.isPending) return <EventLoading label={t("participation.loading")} />;
    const started = Date.parse(event.StartTime) <= now;
    const finished = !!event.FinishTime && Date.parse(event.FinishTime) <= now;
    const tab = explicit ?? defaultParticipationTab({
        teamMode: !!teamMode, captain, memberCount: team?.MemberCount ?? 0, minSize: team?.MinTeamSize ?? info?.MinTeamSize ?? 0,
        pending: members.data?.filter(member => member.Pending).length ?? 0,
    });
    const missing: Record<ParticipationTab, boolean> = {profile: (answers.data?.Missing ?? []).length > 0, team: (team?.MissingFields ?? []).length > 0};
    const tabs: {value: ParticipationTab; label: string}[] = [{value: "profile", label: t("participation.tab.profile")}, ...(tabbed ? [{value: "team" as const, label: t("participation.tab.team")}] : [])];
    const change = (value: ParticipationTab) => {
        setSelected(value);
        window.history.replaceState(null, "", participationTabHref(value));
    };
    return <div className="event-participation">
        <Heading sub={finished ? t("participation.sub.finished", {name: event.Name}) : started ? t("participation.sub.running", {name: event.Name}) : event.Name} />
        {tabbed && <div className="event-manage-participants__filters event-participation__tabs" role="tablist" aria-label={t("participation.tabs")}>{tabs.map(option =>
            <button key={option.value} className="event-manage-participants__filter" type="button" role="tab" aria-selected={tab === option.value} onClick={() => change(option.value)}>
                {option.label}{missing[option.value] && <span className="ib-tag ib-tag--warn event-part__missing">{t("participation.missing.badge")}</span>}
            </button>)}</div>}
        <div role={tabbed ? "tabpanel" : undefined}>
            {tab === "team" ? <TeamTab /> : <ProfileTab event={event} info={info ?? null} team={team} finished={finished} preview={previewing} now={now} onOpenTeam={() => change("team")} />}
        </div>
    </div>;
}
