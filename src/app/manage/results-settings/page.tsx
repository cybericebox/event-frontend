"use client";

import {useState, type FormEvent} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {toast} from "react-hot-toast";
import {getManageConfig, putManageConfig, type ManageConfig, type ManageConfigInput} from "@/api/manage";
import {useManager} from "@/components/event/manage/ManagerShell";
import {ManageFieldLabel} from "@/components/event/manage/ManageFieldLabel";
import {EventLoading} from "@/components/event/EventLoading";
import {EventSelect} from "@/components/ui/EventSelect";

function asInput(config: ManageConfig): ManageConfigInput {
    return {Participation: config.Participation, Registration: config.Registration, ScoreboardVisibility: config.ScoreboardVisibility, ParticipantsVisibility: config.ParticipantsVisibility, PreviewDescription: config.PreviewDescription, PreviewPicture: config.PreviewPicture, MaxTeamSize: config.MaxTeamSize, MinTeamSize: config.MinTeamSize, MaxTeams: config.MaxTeams, DynamicLabsPlanned: config.DynamicLabsPlanned};
}

export default function ResultsSettingsPage() {
    const {event, canManage} = useManager();
    const eventID = event.EventID;
    const queryClient = useQueryClient();
    const configQuery = useQuery({queryKey: ["event-management-config", eventID], queryFn: () => getManageConfig(eventID), refetchOnWindowFocus: false});
    const [edit, setEdit] = useState<{eventID: string; value: 0 | 1 | 2} | null>(null);
    const [saving, setSaving] = useState(false);
    const config = configQuery.data;
    const visibility = edit?.eventID === eventID ? edit.value : config?.ScoreboardVisibility;
    const dirty = config !== undefined && visibility !== config.ScoreboardVisibility;

    async function save(submitEvent: FormEvent<HTMLFormElement>) {
        submitEvent.preventDefault();
        if (!config || visibility === undefined || !canManage || saving || !dirty) return;
        setSaving(true);
        try {
            const updated = await putManageConfig(eventID, {...asInput(config), ScoreboardVisibility: visibility});
            queryClient.setQueryData(["event-management-config", eventID], updated);
            setEdit(null);
            toast.success("Налаштування результатів збережено");
        } catch {toast.error("Не вдалося зберегти налаштування результатів.");}
        finally {setSaving(false);}
    }

    if (configQuery.isPending) return <EventLoading event={event} />;
    if (configQuery.isError || !config) return <div className="event-manage-error" role="alert"><h1>Не вдалося завантажити налаштування результатів</h1><button className="ib-btn" onClick={() => {void configQuery.refetch();}}>Повторити</button></div>;

    return <form className="event-manage-settings event-manage-general" onSubmit={save}>
        <header className="event-manage-heading"><div><h1>Налаштування результатів</h1><p>Визначте, хто може переглядати бали та місця.</p></div></header>
        <section className="event-manage-section"><div className="event-manage-field"><ManageFieldLabel title="Перегляд результатів" help={"Визначає, хто може переглядати бали та місця.\n\n• Приховано — ніхто з відвідувачів.\n• Учасникам — лише авторизовані учасники.\n• Усім — усі відвідувачі сайту."} required /><EventSelect ariaLabel="Перегляд результатів" value={String(visibility)} options={[{value: "0", label: "Приховано"}, {value: "1", label: "Учасникам"}, {value: "2", label: "Усім"}]} onValueChange={value => setEdit({eventID, value: Number(value) as 0 | 1 | 2})} disabled={!canManage || saving} /></div></section>
        {(dirty || saving) && <div className="event-manage-savebar"><button className="ib-btn ib-btn--primary" type="submit" disabled={!canManage || saving}>{saving ? "Зберігаємо…" : "Зберегти"}</button></div>}
    </form>;
}
