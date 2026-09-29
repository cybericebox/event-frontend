"use client";

import {useState} from "react";
import type {LiveLayout} from "@/api/manageLive";
import type {ManageResultsSnapshot} from "@/api/manageResults";
import type {PublicEventInfo} from "@/api/publicEventInfo";
import {DialogModal} from "@/components/event/DialogModal";
import {t} from "@/i18n/t";
import {livePresets, presetLayout, type LivePresetKey} from "../liveLayout";
import {LiveMiniature} from "./LiveMiniature";

const cardBox = {width: 232, height: 131};

// «Застосувати шаблон…»: template cards rendered as live miniatures with
// sample data in the current theme and screen. The replace warning lives in
// the dialog, so applying needs no second confirmation.
export function LiveTemplateDialog({open, layout, event, results, sample, onClose, onApply}: {
    open: boolean; layout: LiveLayout; event: PublicEventInfo; results?: ManageResultsSnapshot; sample: boolean;
    onClose: () => void; onApply: (key: LivePresetKey) => void;
}) {
    const [chosen, setChosen] = useState<LivePresetKey | null>(null);
    const close = () => {setChosen(null); onClose();};
    const keys = Object.keys(livePresets) as LivePresetKey[];
    return <DialogModal open={open} onClose={close} size="md" title={t("manage.live.templates.title")} description={t("manage.live.templates.description")}
        footer={<>
            <button className="ib-btn" type="button" onClick={close}>{t("common.cancel")}</button>
            <button className="ib-btn ib-btn--primary" type="button" disabled={!chosen} onClick={() => {if (chosen) {onApply(chosen); setChosen(null);}}}>{t("manage.live.templates.apply")}</button>
        </>}>
        <div className="event-live-templates" role="radiogroup" aria-label={t("manage.live.templates.title")}>
            {keys.map(key => <button key={key} type="button" role="radio" aria-checked={chosen === key} className="event-live-template" onClick={() => setChosen(key)}>
                <LiveMiniature layout={presetLayout(key, layout)} event={event} results={results} sample={sample} box={cardBox} showGrid={key === "empty"} />
                <strong>{livePresets[key].label}</strong>
                <span>{livePresets[key].description}</span>
            </button>)}
        </div>
        {layout.widgets.length > 0 && <p className="event-live-templates__warning" role="note">{t("manage.live.templates.replace")}</p>}
    </DialogModal>;
}
