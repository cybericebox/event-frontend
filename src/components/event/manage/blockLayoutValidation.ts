import type {ContentBlock} from "@/types/eventContent";
import {t} from "@/i18n/t";

export function blockLayoutProblems(block: ContentBlock): {field: string; message: string}[] {
    const problems: {field: string; message: string}[] = [];
    for (const device of ["desktop", "mobile"] as const) for (const side of ["top", "bottom", "inline"] as const) {
        const value = block.spacing?.[device]?.[side];
        if (value !== undefined && (!Number.isInteger(value) || value < 0 || value > 160)) problems.push({field: `spacing.${device}.${side}`, message: t("manage.blocks.layoutSettings.invalidSpacing")});
    }
    if (block.maxWidth !== undefined && (!Number.isInteger(block.maxWidth) || block.maxWidth < 320 || block.maxWidth > 1920)) problems.push({field: "maxWidth", message: t("manage.blocks.layoutSettings.invalidWidth")});
    if (block.contentAlign !== undefined && !["start", "center", "end"].includes(block.contentAlign)) problems.push({field: "contentAlign", message: t("manage.blocks.layoutSettings.invalidAlign")});
    if (block.textColumns !== undefined && (block.type !== "text" || ![1, 2].includes(block.textColumns))) problems.push({field: "textColumns", message: t("manage.blocks.layoutSettings.invalidColumns")});
    if (block.mobileFullWidth && block.type !== "banner") problems.push({field: "mobileFullWidth", message: t("manage.blocks.layoutSettings.invalidBanner")});
    return problems;
}
