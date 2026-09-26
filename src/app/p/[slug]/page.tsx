import type {Metadata} from "next";
import {getPublicEventInfo} from "@/api/publicEventInfo";
import {getEventPageContent} from "@/api/eventContent";
import {ContentBlocks} from "@/components/event/content/ContentBlocks";
import {ClientContentPage} from "@/components/event/content/ClientContentPage";

export async function generateMetadata({params}: {params: Promise<{slug: string}>}): Promise<Metadata> {
    const {slug} = await params;
    const event = await getPublicEventInfo();
    if (!event) return {robots: {index: false, follow: false}};
    const content = await getEventPageContent(slug);
    return content ? {title: `${content.Page.Title} · ${event.Name}`} : {robots: {index: false, follow: false}};
}

export default async function ContentPage({params}: {params: Promise<{slug: string}>}) {
    const {slug} = await params;
    const event = await getPublicEventInfo();
    if (!event) return <ClientContentPage slug={slug} />;
    const content = await getEventPageContent(slug);
    if (!content) return <ClientContentPage slug={slug} publicEventID={event.EventID} />;
    return <ContentBlocks document={content.Page.Document} variables={content.Variables} title={content.Page.Title} />;
}
