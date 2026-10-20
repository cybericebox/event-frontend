import type {CSSProperties} from "react";
import type {Metadata} from "next";
import {getLiveScreenStart} from "@/api/liveScreenServer";
import {LiveBootstrap} from "@/components/event/live/LiveBootstrap";
import {t} from "@/i18n/t";

// Every request renders anew and nothing is stored anywhere: a screen link
// page is for its screen only (the response headers are set in proxy.ts).
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

type Props = {searchParams: Promise<Record<string, string | string[] | undefined>>};

function tokenOf(value: string | string[] | undefined): string | null {
    const token = Array.isArray(value) ? value[0] : value;
    return token ? token : null;
}

export async function generateMetadata({searchParams}: Props): Promise<Metadata> {
    const token = tokenOf((await searchParams).token);
    // The page never sends its address (with the token) on as a referrer.
    const base: Metadata = {referrer: "no-referrer", robots: {index: false, follow: false}};
    if (!token) return base;
    const start = await getLiveScreenStart(token);
    return start.kind === "ok" ? {...base, title: t("live.documentTitle", {name: start.screen.Event.Name})} : base;
}

// Staff under their own session, or a projector PC with a screen link
// (/live?token=…): the server reads the link and renders the screen in the
// event's style from the first byte; the data comes in the browser. Links of
// the older form (/live#screen=…) move the token into the query once.
export default async function LivePage({searchParams}: Props) {
    const token = tokenOf((await searchParams).token);
    if (!token) return <LiveBootstrap />;
    const start = await getLiveScreenStart(token);
    if (start.kind !== "ok") return <LiveBootstrap link={{token, start}} />;
    const theme = start.screen.Event.Theme;
    const themeStyle = {
        "--ev-brand": theme.Brand, "--ev-accent-light": theme.AccentLight, "--ev-accent-dark": theme.AccentDark, "--ev-accent-live": theme.AccentLive,
    } as CSSProperties;
    return <div className="live-theme" style={themeStyle}><LiveBootstrap link={{token, start}} /></div>;
}
