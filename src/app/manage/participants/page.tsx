import {ParticipantsManager} from "@/components/event/manage/ParticipantsManager";

export default async function ParticipantsPage({searchParams}: {searchParams: Promise<{status?: string}>}) {
    const {status} = await searchParams;
    const initialFilter = status === "pending" ? 1 : status === "approved" ? 2 : status === "rejected" ? 3 : null;
    return <ParticipantsManager key={status ?? "all"} initialFilter={initialFilter} />;
}
