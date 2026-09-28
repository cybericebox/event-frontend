import {ParticipantsManager} from "@/components/event/manage/ParticipantsManager";
import {participantTabFromParams} from "@/components/event/manage/participantTabs";

export default async function ParticipantsPage({searchParams}: {searchParams: Promise<{tab?: string; status?: string}>}) {
    const {tab, status} = await searchParams;
    const initialTab = participantTabFromParams(tab, status);
    return <ParticipantsManager key={initialTab} initialTab={initialTab} />;
}
