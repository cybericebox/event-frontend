"use client";

import {useState} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {toast} from "react-hot-toast";
import {getManageConfig, manageConfigInput, putManageConfig} from "@/api/manage";

// What participants see on a challenge: difficulty and hints (W4 brings hint content).
export function BoardDisplaySettings({eventID, canManage}: {eventID: string; canManage: boolean}) {
    const queryClient = useQueryClient();
    const config = useQuery({queryKey: ["event-management-config", eventID], queryFn: () => getManageConfig(eventID), refetchOnWindowFocus: false});
    const [saving, setSaving] = useState(false);
    if (!config.data) return null;
    const save = async (patch: {ShowDifficulty?: boolean; ShowHints?: boolean}) => {
        if (!config.data || saving) return;
        setSaving(true);
        try {
            queryClient.setQueryData(["event-management-config", eventID], await putManageConfig(eventID, {...manageConfigInput(config.data), ...patch}));
        } catch {
            toast.error("Не вдалося зберегти налаштування дошки.");
        } finally { setSaving(false); }
    };
    return <section className="event-manage-section" aria-labelledby="board-display-title">
        <div className="event-manage-section__head"><h2 id="board-display-title">Показ на дошці</h2><p>Що учасники бачать у вікні завдання.</p></div>
        <label className="event-manage-form__switch"><input type="checkbox" checked={config.data.ShowDifficulty} disabled={!canManage || saving} onChange={event => void save({ShowDifficulty: event.target.checked})} />Показувати складність</label>
        <label className="event-manage-form__switch"><input type="checkbox" checked={config.data.ShowHints} disabled={!canManage || saving} onChange={event => void save({ShowHints: event.target.checked})} />Показувати підказки (для завдань, де їх увімкнено)</label>
    </section>;
}
