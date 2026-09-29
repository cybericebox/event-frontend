"use client";

import {EmptyState} from "@/components/ui/EmptyState";
import {t} from "@/i18n/t";
import {AnalyticsPage} from "./AnalyticsPage";

export type AnalyticsSection = "participants" | "tasks" | "progress" | "stands" | "integrity" | "communications" | "report";

// A section that is not built yet: its heading and one EmptyState. The section
// agent replaces the page that renders this with the real report.
export function AnalyticsPlaceholder({section}: {section: AnalyticsSection}) {
    return <AnalyticsPage title={t(`manage.analytics.section.${section}.title`)} description={t(`manage.analytics.section.${section}.description`)}>
        <div className="event-analytics__block"><EmptyState message={t("manage.analytics.placeholder")} /></div>
    </AnalyticsPage>;
}
