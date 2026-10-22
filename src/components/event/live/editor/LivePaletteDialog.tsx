"use client";

import type {LiveLayout} from "@/api/manageLive";
import type {ManageResultsSnapshot} from "@/api/manageResults";
import type {PublicEventInfo} from "@/api/publicEventInfo";
import {DialogModal} from "@/components/event/DialogModal";
import {t} from "@/i18n/t";
import type {LivePaletteItem} from "../liveLayout";
import {LiveMiniature} from "./LiveMiniature";

const previewBox = {width: 600, height: 300};

// A palette item opened from the palette: the block large, with sample data,
// what it shows and «Додати на екран». Dragging an item still adds it
// directly; this is the look before adding.
export function LivePaletteDialog({item, layout, event, results, sample, canAdd, blocked, onClose, onAdd}: {
    item: LivePaletteItem | null; layout: LiveLayout | null; event: PublicEventInfo; results?: ManageResultsSnapshot; sample: boolean;
    // canAdd: the block may be added to this screen now; blocked: why not.
    canAdd: boolean; blocked: string | null;
    onClose: () => void; onAdd: (item: LivePaletteItem) => void;
}) {
    return <DialogModal open={!!item} onClose={onClose} size="md" title={item?.label ?? ""} description={item?.description}
        footer={<>
            <button className="ib-btn" type="button" onClick={onClose}>{t("common.cancel")}</button>
            <button className="ib-btn ib-btn--primary" type="button" disabled={!canAdd} onClick={() => {if (item) onAdd(item);}}>{t("manage.live.palettePreview.add")}</button>
        </>}>
        {item && layout && <div className="event-live-palette-preview">
            <LiveMiniature layout={layout} event={event} results={results} sample={sample} box={previewBox} crop={item.preview} />
            <p>{t("manage.live.palettePreview.size", {w: item.preview.w, h: item.preview.h})}</p>
            {blocked && <p className="event-live-palette-preview__blocked" role="note">{blocked}</p>}
        </div>}
    </DialogModal>;
}
