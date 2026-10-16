"use client";

import {useQuery} from "@tanstack/react-query";
import {getManageParticipantForm} from "@/api/manageParticipantForm";
import type {PublicEventInfo} from "@/types/publicEventInfo";
import {useParticipantPreview, participantPreviewForm} from "../ParticipantPreview";
import {t} from "@/i18n/t";
import {ProfileTab} from "./ProfileTab";
import {TeamTab} from "./TeamPage";
import {AnswersCard} from "./AnswersCard";
import {useNow} from "./useNow";
import {participationTabHref} from "./participationModel";

export function PreviewParticipation({event, selected, onSelect}: {event: PublicEventInfo; selected: string | null; onSelect: (value: string) => void}) {
    const preview = useParticipantPreview(event.EventID);
    const form = useQuery({queryKey: ["event-management-participant-form", event.EventID], queryFn: () => getManageParticipantForm(event.EventID), select: participantPreviewForm, retry: false, refetchOnWindowFocus: false});
    const now = useNow();
    const tab = event.Participation === 1 && selected === "team" ? "team" : "profile";
    const change = (value: "profile" | "team") => {onSelect(value); window.history.replaceState(window.history.state, "", participationTabHref(value));};
    return <div className="event-participation">
        <header className="ib-page-header"><h1 className="ib-page-header__title">{t("participation.title")}</h1></header>
        {event.Participation === 1 && <div className="event-manage-participants__filters event-participation__tabs" role="tablist" aria-label={t("participation.tabs")}>
            {(["profile", "team"] as const).map(value => <button key={value} className="event-manage-participants__filter" type="button" role="tab" aria-selected={value === tab} onClick={() => change(value)}>{t(`participation.tab.${value}`)}</button>)}
        </div>}
        <div role={event.Participation === 1 ? "tabpanel" : undefined}>{tab === "team" ? <TeamTab /> : <>
            <ProfileTab event={event} info={null} team={preview.state!.team} finished={false} preview now={now} onOpenTeam={() => change("team")} />
            {form.data?.Enabled && <AnswersCard scope="participant" title={t("participation.form.cardTitle")} note={t("participation.self.note")} form={form.data} answers={preview.state!.answers} missing={[]} canEdit whyReadOnly="" onSave={async answers => preview.update({answers})} />}
        </>}</div>
    </div>;
}
