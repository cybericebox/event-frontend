import type {Metadata} from "next";
import {getPublicEventInfo} from "@/api/publicEventInfo";
import {getEventPageContent} from "@/api/eventContent";
import {LiveContentBlocks} from "@/components/event/content/LiveContentBlocks";
import {ClientContentPage} from "@/components/event/content/ClientContentPage";

export async function generateMetadata({params}: {params: Promise<{slug: string}>}): Promise<Metadata> {
    const {slug} = await params;
    const event = await getPublicEventInfo();
    if (!event) return {robots: {index: false, follow: false}};
    const content = await getEventPageContent(slug);
    return content ? {title: event.Name, description: `${content.Page.Title} · ${event.Name} · Cyber ICE Box`} : {robots: {index: false, follow: false}};
}

export default async function ContentPage({params}: {params: Promise<{slug: string}>}) {
    const {slug} = await params;
    const event = await getPublicEventInfo();
    if (!event) return <ClientContentPage slug={slug} />;
    const content = await getEventPageContent(slug);
    if (!content) return <ClientContentPage slug={slug} publicEventID={event.EventID} />;
    return <LiveContentBlocks eventID={event.EventID} document={content.Page.Document} initialVariables={content.Variables} title={content.Page.Title} coverImage={event.PreviewPicture} page={slug} />;
}
