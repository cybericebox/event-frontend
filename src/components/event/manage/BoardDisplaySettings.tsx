"use client";

import {useState} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {toast} from "react-hot-toast";
import {getManageConfig, manageConfigInput, putManageConfig, type ManageConfig} from "@/api/manage";

const chargeModes: Array<{value: ManageConfig["HintChargeMode"]; label: string; note: string}> = [
    {value: "reward", label: "Зменшують винагороду за завдання", note: "За замовчуванням. Списується під час розвʼязання, не нижче нуля."},
    {value: "balance", label: "Списуються з балансу одразу", note: "Бали знімаються в момент відкриття підказки."},
];

// What participants see on a challenge (difficulty, hints) and how paid hints are charged.
export function BoardDisplaySettings({eventID, canManage}: {eventID: string; canManage: boolean}) {
    const queryClient = useQueryClient();
    const config = useQuery({queryKey: ["event-management-config", eventID], queryFn: () => getManageConfig(eventID), refetchOnWindowFocus: false});
    const [saving, setSaving] = useState(false);
    if (!config.data) return null;
    const save = async (patch: Partial<Pick<ManageConfig, "ShowDifficulty" | "ShowHints" | "HintChargeMode">>) => {
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
        <fieldset className="event-hint-charge" disabled={!canManage || saving}>
            <legend>Як списуються платні підказки</legend>
            <div className="event-manage-choice-group">{chargeModes.map(mode => <label key={mode.value}><input type="radio" name="hint-charge-mode" value={mode.value} checked={config.data!.HintChargeMode === mode.value} onChange={() => void save({HintChargeMode: mode.value})} /><span><strong>{mode.label}</strong><small>{mode.note}</small></span></label>)}</div>
        </fieldset>
    </section>;
}
