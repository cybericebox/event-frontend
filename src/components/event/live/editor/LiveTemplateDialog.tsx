"use client";

import {useMemo, useState} from "react";
import type {LiveLayout} from "@/api/manageLive";
import type {ManageResultsSnapshot} from "@/api/manageResults";
import type {PublicEventInfo} from "@/api/publicEventInfo";
import {DialogModal} from "@/components/event/DialogModal";
import {t} from "@/i18n/t";
import {liveSceneLayout, liveScenePreviewNow, liveScenePreviewResults, type LiveSceneKey} from "../liveScenes";
import type {LiveStage} from "../liveStages";
import {applyLiveTemplate, liveTemplates, type LiveTemplateKey} from "../liveTemplates";
import {LiveMiniature} from "./LiveMiniature";

const cardBox = {width: 232, height: 131};
const showBox = {width: 152, height: 86};
const showScenes = ["before", "running", "finished"] as const;
const templateKeys = Object.keys(liveTemplates) as LiveTemplateKey[];

// «Шаблони»: template cards rendered as live miniatures with sample data in
// the current theme and screen. «Повний показ» shows its three scenes; any
// other template fills the scene being edited. The replace warning lives in
// the dialog (and Ctrl+Z undoes), so applying needs no second confirmation.
export function LiveTemplateDialog({open, layout, scene, event, stages, results, sample, onClose, onApply}: {
    open: boolean; layout: LiveLayout; scene: LiveSceneKey; event: PublicEventInfo; stages?: LiveStage[]; results?: ManageResultsSnapshot; sample: boolean;
    onClose: () => void; onApply: (key: LiveTemplateKey) => void;
}) {
    const [chosen, setChosen] = useState<LiveTemplateKey | null>(null);
    // Each card shows its scene at a moment of that state, as the screen will.
    const [openedAt] = useState(() => Date.now());
    const card = (key: LiveSceneKey) => ({event, stages, sample, nowOffset: liveScenePreviewNow(key, event, openedAt) - openedAt,
        results: liveScenePreviewResults(key, results, liveScenePreviewNow(key, event, openedAt))});
    const close = () => {setChosen(null); onClose();};
    // The cards are built once per screen setup, so their widgets (and ids) stay while the dialog is open.
    const {version, theme, aspect, screen, refreshSeconds} = layout;
    const layouts = useMemo(() => {
        const base: LiveLayout = {version, theme, aspect, screen, refreshSeconds, grid: {cols: 12, rows: 8}, widgets: []};
        return new Map(templateKeys.map(key => [key, applyLiveTemplate(base, key, "running")]));
    }, [version, theme, aspect, screen, refreshSeconds]);
    const target = chosen && liveTemplates[chosen].scene === "all" ? null : scene;
    const replaces = chosen ? liveTemplates[chosen].scene === "all" ? true : liveSceneLayout(layout, scene).widgets.length > 0 : false;
    return <DialogModal open={open} onClose={close} size="md" title={t("manage.live.templates.title")} description={t("manage.live.templates.description", {scene: t(`manage.live.scene.${scene}`)})}
        footer={<>
            <button className="ib-btn" type="button" onClick={close}>{t("common.cancel")}</button>
            <button className="ib-btn ib-btn--primary" type="button" disabled={!chosen} onClick={() => {if (chosen) {onApply(chosen); setChosen(null);}}}>
                {target ? t("manage.live.templates.applyTo", {scene: t(`manage.live.scene.${target}`)}) : t("manage.live.templates.applyAll")}
            </button>
        </>}>
        <div className="event-live-templates" role="radiogroup" aria-label={t("manage.live.templates.title")}>
            {templateKeys.map(key => {
                const template = liveTemplates[key];
                const result = layouts.get(key)!;
                return <button key={key} type="button" role="radio" aria-checked={chosen === key} className={`event-live-template${template.scene === "all" ? " event-live-template--show" : ""}`} onClick={() => setChosen(key)}>
                    {template.scene === "all"
                        ? <span className="event-live-template__scenes">{showScenes.map(item => <span key={item}>
                            <LiveMiniature layout={liveSceneLayout(result, item)} {...card(item)} box={showBox} />
                            <small>{t(`manage.live.scene.${item}`)}</small>
                        </span>)}</span>
                        : <LiveMiniature layout={liveSceneLayout(result, "running")} {...card(template.scene)} box={cardBox} showGrid={key === "empty"} />}
                    <strong>{template.label}{template.scene !== "all" && <em>{t("manage.live.templates.for", {scene: t(`manage.live.scene.${template.scene}`)})}</em>}</strong>
                    <span>{template.description}</span>
                </button>;
            })}
        </div>
        {replaces && <p className="event-live-templates__warning" role="note">{t(target ? "manage.live.templates.replaceScene" : "manage.live.templates.replaceAll", {scene: t(`manage.live.scene.${scene}`)})}</p>}
    </DialogModal>;
}
