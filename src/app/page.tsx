import {notFound} from "next/navigation";
import type {Metadata} from "next";
import {getPublicEventInfo} from "@/api/publicEventInfo";
import {getCommonPage} from "@/api/commonPage";
import {getLandingContent} from "@/api/eventContent";
import {LiveContentBlocks} from "@/components/event/content/LiveContentBlocks";
import {PrivateLanding} from "@/components/event/content/PrivateLanding";

export async function generateMetadata(): Promise<Metadata> {
    const event = await getPublicEventInfo();
    return event ? {title: event.Name} : {robots: {index: false, follow: false}};
}

export default async function LandingPage() {
    const event = await getPublicEventInfo();
    if (!event) return <PrivateLanding />;
    const content = await getLandingContent();
    if (!content) notFound();

    const bundle = (await getCommonPage())!;
    return <div className="event-landing ib-blocks">
        <LiveContentBlocks imageDimensions={bundle.Images} revision={bundle.Revision} eventID={event.EventID} document={content.Landing} initialVariables={content.Variables} title={event.Name} coverImage={event.PreviewPicture} />
    </div>;
}
