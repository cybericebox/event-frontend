import {notFound} from "next/navigation";
import type {Metadata} from "next";
import {getPublicEventInfo} from "@/api/publicEventInfo";
import {getLandingContent} from "@/api/eventContent";
import {ContentBlocks} from "@/components/event/content/ContentBlocks";
import {PrivateLanding} from "@/components/event/content/PrivateLanding";
import {MockLanding} from "@/components/event/content/MockLanding";

export async function generateMetadata(): Promise<Metadata> {
    const event = await getPublicEventInfo();
    return event ? {title: event.Name} : {robots: {index: false, follow: false}};
}

export default async function LandingPage() {
    const event = await getPublicEventInfo();
    if (!event) return <PrivateLanding />;
    const content = await getLandingContent();
    if (!content) notFound();
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") return <MockLanding initial={content} eventName={event.Name} coverImage={event.PreviewPicture} />;

    return <div className="event-landing ib-blocks">
        {content.Landing.blocks.length > 0 && !content.Landing.blocks.some(block => block.type === "hero") && <h1 className="ib-visually-hidden">{event.Name}</h1>}
        <ContentBlocks document={content.Landing} variables={content.Variables} coverImage={event.PreviewPicture} />
    </div>;
}
