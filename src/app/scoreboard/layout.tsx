import type {Metadata} from "next";
import {getPublicEventInfo} from "@/api/publicEventInfo";
import {eventPageMetadata} from "@/utils/pageMetadata";
import {t} from "@/i18n/t";

export async function generateMetadata(): Promise<Metadata> {
    const base = await eventPageMetadata(t("scoreboard.title"));
    try {
        const event = await getPublicEventInfo();
        return event ? {...base, description: t("meta.scoreboard.description", {name: event.Name})} : base;
    } catch {
        return base;
    }
}

export default function ScoreboardLayout({children}: {children: React.ReactNode}) {
    return children;
}
