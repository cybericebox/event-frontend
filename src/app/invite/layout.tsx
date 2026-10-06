import type {Metadata} from "next";
import {eventPageMetadata} from "@/utils/pageMetadata";
import {t} from "@/i18n/t";

export function generateMetadata(): Promise<Metadata> {
    return eventPageMetadata(t("invite.title"), {noindex: true});
}

export default function Layout({children}: {children: React.ReactNode}) {
    return children;
}
