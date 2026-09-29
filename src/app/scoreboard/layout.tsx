import type {Metadata} from "next";
import {getPublicEventInfo} from "@/api/publicEventInfo";

export async function generateMetadata(): Promise<Metadata> {
    try {
        const event = await getPublicEventInfo();
        return event ? {description: `Результати ${event.Name} наживо · Cyber ICE Box`} : {};
    } catch {
        return {};
    }
}

export default function ScoreboardLayout({children}: {children: React.ReactNode}) {
    return children;
}
