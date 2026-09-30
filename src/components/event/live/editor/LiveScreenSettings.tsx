"use client";

import {useRef} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {toast} from "react-hot-toast";
import {liveRefreshOptions, type LiveLayout} from "@/api/manageLive";
import type {ManageResultsSnapshot, ResultsSettings} from "@/api/manageResults";
import {getResultsSettings, putResultsSettings, resultsSettingsInput} from "@/api/manageResults";
import type {PublicEventInfo} from "@/api/publicEventInfo";
import {EventLoadError} from "@/components/event/EventLoadError";
import {t} from "@/i18n/t";
import {EventSelect} from "@/components/ui/EventSelect";
import {EventSlider} from "@/components/ui/EventSlider";
import {LiveMiniature} from "./LiveMiniature";
import {LiveField, LiveNumberInput, LiveSwitch} from "./LiveFields";

// «Враховувати заморожування результатів»: a results setting, applied at once.
export function LiveFreezeToggle({eventID, canManage}: {eventID: string; canManage: boolean}) {
    const queryClient = useQueryClient();
    const queryKey = ["event-management-results-settings", eventID];
    const settings = useQuery({queryKey, queryFn: () => getResultsSettings(eventID), refetchOnWindowFocus: false});
    // The switch flips at once; saves run one after another and never disable it.
    const queue = useRef<Promise<void>>(Promise.resolve());
    const waiting = useRef(0);
    function change(value: boolean) {
        const current = queryClient.getQueryData<ResultsSettings>(queryKey);
        if (!current) return;
        queryClient.setQueryData<ResultsSettings>(queryKey, {...current, LiveFreeze: value});
        waiting.current += 1;
        queue.current = queue.current.then(async () => {
            try {
                const wanted = queryClient.getQueryData<ResultsSettings>(queryKey) ?? current;
                const saved = await putResultsSettings(eventID, {...resultsSettingsInput(wanted), LiveFreeze: wanted.LiveFreeze});
                waiting.current -= 1;
                const shown = queryClient.getQueryData<ResultsSettings>(queryKey);
                // Apply the answer only when no newer change waits and it differs from what is shown.
                if (waiting.current === 0 && JSON.stringify(saved) !== JSON.stringify(shown)) queryClient.setQueryData(queryKey, saved);
                void queryClient.invalidateQueries({queryKey: ["event-live-results", eventID]});
                toast.success(t(saved.LiveFreeze ? "manage.live.freeze.on" : "manage.live.freeze.off"));
            } catch {
                waiting.current -= 1;
                if (waiting.current === 0) await queryClient.invalidateQueries({queryKey});
                toast.error(t("manage.live.freeze.error"));
            }
        });
    }
    const hint = settings.data && !settings.data.FreezeEnabled ? t("manage.live.freeze.disabled") : null;
    if (settings.isError) return <div className="event-live-settings__freeze"><EventLoadError compact message={t("manage.live.freeze.readError")} error={settings.error} onRetry={() => void settings.refetch()} /></div>;
    return <div className="event-live-settings__freeze">
        <LiveSwitch label={t("manage.live.freeze.label")} help={t("manage.live.freeze.help")} checked={settings.data?.LiveFreeze ?? true} disabled={!canManage || !settings.data} onChange={change} />
        {hint && <small>{hint}</small>}
    </div>;
}

const themes = ["dark", "light"] as const;
const baseRatios = {"16:9": 16 / 9, "16:10": 16 / 10, "4:3": 4 / 3, "5:3": 5 / 3};

// Settings of the whole screen, shown while no widget is selected.
export function LiveScreenSettings({eventID, event, layout, results, sample, canManage, disabled, onChange}: {
    eventID: string; event: PublicEventInfo; layout: LiveLayout; results?: ManageResultsSnapshot; sample: boolean;
    canManage: boolean; disabled: boolean; onChange: (next: LiveLayout) => void;
}) {
    const scale = Math.round(layout.screen.textScale * 100);
    return <div className="event-live-settings">
        <h3>{t("manage.live.screen")}</h3>
        <LiveField label={t("manage.live.theme")} help={t("manage.live.themeHelp")}>
            {() => <div className="event-live-themes" role="radiogroup" aria-label={t("manage.live.theme")}>
                {themes.map(theme => <button key={theme} type="button" role="radio" aria-checked={layout.theme === theme} disabled={disabled} className="event-live-theme" onClick={() => onChange({...layout, theme})}>
                    <LiveMiniature layout={{...layout, theme}} event={event} results={results} sample={sample} box={{width: 112, height: 63}} />
                    <span>{t(theme === "dark" ? "manage.live.themeDark" : "manage.live.themeLight")}</span>
                </button>)}
            </div>}
        </LiveField>
        <LiveField label={t("manage.live.textScale")} help={t("manage.live.textScaleHelp")}>
            {() => <div className="event-live-settings__slider">
                <EventSlider min={80} max={150} step={5} value={scale} disabled={disabled} ariaLabel={t("manage.live.textScale")} valueText={t("manage.live.percent", {value: scale})}
                    onValueChange={value => onChange({...layout, screen: {...layout.screen, textScale: value / 100}})} />
                <output>{t("manage.live.percent", {value: scale})}</output>
            </div>}
        </LiveField>
        <LiveField label={t("manage.live.refreshInterval")} help={t("manage.live.refreshHelp")} required>
            {() => <EventSelect ariaLabel={t("manage.live.refreshInterval")} value={String(layout.refreshSeconds)} disabled={disabled}
                options={[...new Set([...liveRefreshOptions, layout.refreshSeconds])].sort((a, b) => a - b).map(value => ({value: String(value), label: t("manage.live.seconds", {count: value})}))}
                onValueChange={value => onChange({...layout, refreshSeconds: Number(value)})} />}
        </LiveField>
        <LiveField label={t("manage.live.baseFormat")} help={t("manage.live.baseFormatHelp")} required>
            {() => <EventSelect ariaLabel={t("manage.live.baseFormat")} value={layout.aspect} disabled={disabled}
                onValueChange={value => {
                    const aspect = value as LiveLayout["aspect"];
                    onChange({...layout, aspect, screen: {...layout.screen, width: aspect === "custom" ? layout.screen.width : Math.round(layout.screen.height * baseRatios[aspect])}});
                }}
                options={(["16:9", "16:10", "4:3", "5:3", "custom"] as const).map(value => ({value, label: value === "custom" ? t("manage.live.aspectCustom") : value}))} />}
        </LiveField>
        <LiveField label={t("manage.live.anchor")} help={t("manage.live.anchorHelp")} required>
            {() => <EventSelect ariaLabel={t("manage.live.anchor")} value={layout.screen.anchor} disabled={disabled} onValueChange={value => onChange({...layout, screen: {...layout.screen, anchor: value as LiveLayout["screen"]["anchor"]}})}
                options={[{value: "full", label: t("manage.live.anchorFull")}, {value: "top-left", label: t("manage.live.anchorTopLeft")}]} />}
        </LiveField>
        {layout.screen.anchor === "top-left" && <div className="event-live-settings__cells event-live-settings__cells--two">
            <LiveField label={t("manage.live.areaWidth")} help={t("manage.live.areaWidthHelp")} required>
                {id => <LiveNumberInput id={id} value={layout.screen.width} min={320} max={7680} disabled={disabled} onChange={width => onChange({...layout, aspect: "custom", screen: {...layout.screen, width}})} />}
            </LiveField>
            <LiveField label={t("manage.live.areaHeight")} help={t("manage.live.areaHeightHelp")} required>
                {id => <LiveNumberInput id={id} value={layout.screen.height} min={240} max={4320} disabled={disabled} onChange={height => onChange({...layout, aspect: "custom", screen: {...layout.screen, height}})} />}
            </LiveField>
        </div>}
        <LiveFreezeToggle eventID={eventID} canManage={canManage} />
    </div>;
}
