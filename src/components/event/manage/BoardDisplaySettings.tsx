"use client";

import {useState} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {toast} from "react-hot-toast";
import {getManageConfig, manageConfigInput, putManageConfig, type ManageConfig} from "@/api/manage";
import {t} from "@/i18n/t";
import {EventSwitch} from "@/components/ui/EventSwitch";

const chargeModes: Array<{value: ManageConfig["HintChargeMode"]; label: string; note: string}> = [
    {value: "reward", label: t("manage.board.charge.reward"), note: t("manage.board.charge.rewardNote")},
    {value: "balance", label: t("manage.board.charge.balance"), note: t("manage.board.charge.balanceNote")},
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
            toast.error(t("manage.board.saveFailed"));
        } finally { setSaving(false); }
    };
    return <section className="event-manage-section" aria-labelledby="board-display-title">
        <div className="event-manage-section__head"><h2 id="board-display-title">{t("manage.board.title")}</h2><p>{t("manage.board.subtitle")}</p></div>
        <EventSwitch className="event-manage-form__switch" checked={config.data.ShowDifficulty} disabled={!canManage || saving} onCheckedChange={checked => void save({ShowDifficulty: checked})} label={t("manage.board.showDifficulty")} />
        <EventSwitch className="event-manage-form__switch" checked={config.data.ShowHints} disabled={!canManage || saving} onCheckedChange={checked => void save({ShowHints: checked})} label={t("manage.board.showHints")} />
        <fieldset className="event-hint-charge" disabled={!canManage || saving}>
            <legend>{t("manage.board.chargeLegend")}</legend>
            <div className="event-manage-choice-group">{chargeModes.map(mode => <label key={mode.value}><input type="radio" name="hint-charge-mode" value={mode.value} checked={config.data!.HintChargeMode === mode.value} onChange={() => void save({HintChargeMode: mode.value})} /><span><strong>{mode.label}</strong><small>{mode.note}</small></span></label>)}</div>
        </fieldset>
    </section>;
}
