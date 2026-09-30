import Link from "next/link";
import type {ContentBlock} from "@/types/eventContent";
import type {ContentVariableDefinition} from "@/components/event/content/variableCatalog";
import {blockDataGap} from "@/components/event/content/blockDataGaps";
import {t} from "@/i18n/t";

type Value = string | number | boolean | null;

export function BlockDataGapNotice({block, values, catalog}: {
    block: ContentBlock;
    values: Record<string, Value>;
    catalog: ContentVariableDefinition[];
}) {
    const gap = blockDataGap(block, values);
    if (!gap) return null;
    const label = gap.variable ? catalog.find(item => item.name === gap.variable)?.label : undefined;
    const message = block.type === "hero"
        ? (label ? t("manage.blocks.gap.heroNamed", {name: label}) : t("manage.blocks.gap.hero"))
        : (label ? t("manage.blocks.gap.countdownNamed", {name: label}) : t("manage.blocks.gap.countdown"));
    return <p className="event-manage-validation event-manage-validation--warning" role="status">
        {message}{gap.variable && <> <Link className="ib-link" href="/manage/schedule">{t("manage.blocks.gap.open")}</Link></>}
    </p>;
}
