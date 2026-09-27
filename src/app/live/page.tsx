import {notFound} from "next/navigation";
import {getPublicEventInfo} from "@/api/publicEventInfo";
import {getLiveContent} from "@/api/eventContent";
import {LiveScreen} from "@/components/event/live/LiveScreen";

export default async function LivePage() {
    const event = await getPublicEventInfo();
    if (!event) notFound();
    const layout = await getLiveContent();
    if (!layout) notFound();
    return <LiveScreen event={event} layout={layout} />;
}
