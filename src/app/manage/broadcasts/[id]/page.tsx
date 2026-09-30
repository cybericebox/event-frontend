import {BroadcastDetails} from "@/components/event/manage/broadcasts/BroadcastDetails";

export default async function BroadcastPage({params}: {params: Promise<{id: string}>}) {
    const {id} = await params;
    return <BroadcastDetails key={id} broadcastID={id} />;
}
