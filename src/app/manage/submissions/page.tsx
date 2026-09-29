import {AttemptsManager} from "@/components/event/manage/AttemptsManager";
import {journalViewFromParams} from "@/components/event/manage/journalViews";

export default async function SubmissionsPage({searchParams}: {searchParams: Promise<{tab?: string}>}) {
    const {tab} = await searchParams;
    return <AttemptsManager initialView={journalViewFromParams(tab)} />;
}
