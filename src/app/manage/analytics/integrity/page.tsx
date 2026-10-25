import {notFound} from "next/navigation";
import {showIntegrity} from "@/utils/origins";
import {AnalyticsIntegrity} from "@/components/event/manage/analytics/AnalyticsIntegrity";
import {journalFiltersFromParams} from "@/components/event/manage/journalViews";

// /manage/analytics/integrity?teamId=…&challengeId=… presets the team and task
// filters (the attempts journal's warning icon links here).
export default async function AnalyticsIntegrityPage({searchParams}: {searchParams: Promise<{teamId?: string; challengeId?: string}>}) {
    if (!showIntegrity) notFound();
    const {teamId, challengeId} = await searchParams;
    const filters = journalFiltersFromParams({teamId, challengeId});
    return <AnalyticsIntegrity initialFilters={{teamId: filters.teamID ?? undefined, challengeId: filters.challengeID ?? undefined}} />;
}
