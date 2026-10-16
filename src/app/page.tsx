import type {Metadata} from "next";
import {getPublicEventInfo} from "@/api/publicEventInfo";

export async function generateMetadata(): Promise<Metadata> {
    const event = await getPublicEventInfo();
    return event ? {title: event.Name} : {robots: {index: false, follow: false}};
}

import {EventLanding} from "@/components/event/content/EventLanding";

export default function LandingPage() {return <EventLanding />;}
