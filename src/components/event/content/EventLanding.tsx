import {notFound} from "next/navigation";
import {getPublicEventInfo} from "@/api/publicEventInfo";
import {getCommonPage} from "@/api/commonPage";
import {getLandingContent} from "@/api/eventContent";
import {LiveContentBlocks} from "@/components/event/content/LiveContentBlocks";
import {PrivateLanding} from "@/components/event/content/PrivateLanding";

export async function EventLanding() {
    const event = await getPublicEventInfo();
    if (!event) return <PrivateLanding />;
    const content = await getLandingContent();
    if (!content) notFound();

    const bundle = (await getCommonPage())!;
    // This server-only request snapshot becomes the client's deterministic initial clock.
    // eslint-disable-next-line react-hooks/purity
    const initialNow = Date.now();
    return <div className="event-landing ib-blocks">
        <LiveContentBlocks initialNow={initialNow} imageDimensions={bundle.Images} revision={bundle.Revision} eventID={event.EventID} document={content.Landing} initialVariables={content.Variables} title={event.Name} coverImage={event.PreviewPicture} />
    </div>;
}
