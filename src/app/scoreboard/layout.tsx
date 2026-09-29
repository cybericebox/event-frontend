import type {Metadata} from "next";
import {getPublicEventInfo} from "@/api/publicEventInfo";
import {t} from "@/i18n/t";

export async function generateMetadata(): Promise<Metadata> {
    try {
        const event = await getPublicEventInfo();
        return event ? {description: t("meta.scoreboard.description", {name: event.Name})} : {};
    } catch {
        return {};
    }
}

export default function ScoreboardLayout({children}: {children: React.ReactNode}) {
    return children;
}
