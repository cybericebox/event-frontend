import {AttemptsManager} from "@/components/event/manage/AttemptsManager";
import {journalViewFromParams, type JournalFilterParams} from "@/components/event/manage/journalViews";

export default async function SubmissionsPage({searchParams}: {searchParams: Promise<{tab?: string} & JournalFilterParams>}) {
    const {tab, teamId, challengeId, from, to} = await searchParams;
    return <AttemptsManager initialView={journalViewFromParams(tab)} initialFilters={{teamId, challengeId, from, to}} />;
}
