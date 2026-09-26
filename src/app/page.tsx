import {notFound} from "next/navigation";
import type {Metadata} from "next";
import {getPublicEventInfo} from "@/api/publicEventInfo";
import {getLandingContent} from "@/api/eventContent";
import {ContentBlocks} from "@/components/event/content/ContentBlocks";
import {LandingHero} from "@/components/event/content/LandingHero";
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

    return <div className="event-landing ib-blocks">
        {content.Landing.blocks.length === 0 && <LandingHero event={event} />}
        {content.Landing.blocks.length > 0 && !content.Landing.blocks.some(block => block.type === "hero") && <h1 className="ib-visually-hidden">{event.Name}</h1>}
        <ContentBlocks document={content.Landing} variables={content.Variables} coverImage={event.PreviewPicture} />
    </div>;
}
