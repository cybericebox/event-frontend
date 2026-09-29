"use client";

import {useState} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {toast} from "react-hot-toast";
import {liveRefreshOptions, type LiveLayout} from "@/api/manageLive";
import type {ManageResultsSnapshot} from "@/api/manageResults";
import {getResultsSettings, putResultsSettings, resultsSettingsInput} from "@/api/manageResults";
import type {PublicEventInfo} from "@/api/publicEventInfo";
import {t} from "@/i18n/t";
import {EventSelect} from "@/components/ui/EventSelect";
import {EventSlider} from "@/components/ui/EventSlider";
import {EventSwitch} from "@/components/ui/EventSwitch";
import {LiveMiniature} from "./LiveMiniature";
import {LiveField} from "./LiveWidgetSettings";

// «Враховувати заморожування результатів»: a results setting, applied at once.
function LiveFreezeToggle({eventID, canManage}: {eventID: string; canManage: boolean}) {
    const queryClient = useQueryClient();
    const queryKey = ["event-management-results-settings", eventID];
    const settings = useQuery({queryKey, queryFn: () => getResultsSettings(eventID), refetchOnWindowFocus: false});
    const [busy, setBusy] = useState(false);
    async function change(value: boolean) {
        if (!settings.data) return;
        setBusy(true);
        try {
            queryClient.setQueryData(queryKey, await putResultsSettings(eventID, {...resultsSettingsInput(settings.data), LiveFreeze: value}));
            await queryClient.invalidateQueries({queryKey: ["event-live-results", eventID]});
            toast.success(t(value ? "manage.live.freeze.on" : "manage.live.freeze.off"));
        } catch {toast.error(t("manage.live.freeze.error"));}
        finally {setBusy(false);}
    }
    const hint = t(settings.isError ? "manage.live.freeze.readError" : settings.data && !settings.data.FreezeEnabled ? "manage.live.freeze.disabled" : "manage.live.freeze.immediate");
    return <div className="event-live-settings__freeze">
        <EventSwitch checked={settings.data?.LiveFreeze ?? true} disabled={!canManage || busy || !settings.data} onCheckedChange={value => void change(value)} label={t("manage.live.freeze.label")} />
        <small>{hint}</small>
    </div>;
}

const themes = ["dark", "light"] as const;

// Settings of the whole screen, shown while no widget is selected.
export function LiveScreenSettings({eventID, event, layout, results, sample, canManage, disabled, onChange}: {
    eventID: string; event: PublicEventInfo; layout: LiveLayout; results?: ManageResultsSnapshot; sample: boolean;
    canManage: boolean; disabled: boolean; onChange: (next: LiveLayout) => void;
}) {
    const scale = Math.round(layout.screen.textScale * 100);
    return <div className="event-live-settings">
        <h3>{t("manage.live.screen")}</h3>
        <LiveField label={t("manage.live.theme")}>
            <div className="event-live-themes" role="radiogroup" aria-label={t("manage.live.theme")}>
                {themes.map(theme => <button key={theme} type="button" role="radio" aria-checked={layout.theme === theme} disabled={disabled} className="event-live-theme" onClick={() => onChange({...layout, theme})}>
                    <LiveMiniature layout={{...layout, theme}} event={event} results={results} sample={sample} box={{width: 112, height: 63}} />
                    <span>{t(theme === "dark" ? "manage.live.themeDark" : "manage.live.themeLight")}</span>
                </button>)}
            </div>
        </LiveField>
        <LiveField label={t("manage.live.textScale")} hint={t("manage.live.textScaleHint")}>
            <div className="event-live-settings__slider">
                <EventSlider min={80} max={150} step={5} value={scale} disabled={disabled} ariaLabel={t("manage.live.textScale")} valueText={t("manage.live.percent", {value: scale})}
                    onValueChange={value => onChange({...layout, screen: {...layout.screen, textScale: value / 100}})} />
                <output>{t("manage.live.percent", {value: scale})}</output>
            </div>
        </LiveField>
        <LiveField label={t("manage.live.refreshInterval")} hint={t("manage.live.refreshHint")}>
            <EventSelect ariaLabel={t("manage.live.refreshInterval")} value={String(layout.refreshSeconds)} disabled={disabled}
                options={[...new Set([...liveRefreshOptions, layout.refreshSeconds])].sort((a, b) => a - b).map(value => ({value: String(value), label: t("manage.live.seconds", {count: value})}))}
                onValueChange={value => onChange({...layout, refreshSeconds: Number(value)})} />
        </LiveField>
        <LiveFreezeToggle eventID={eventID} canManage={canManage} />
    </div>;
}
