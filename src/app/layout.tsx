import type {Metadata} from "next";
import "./globals.css";
import "@/styles/tokens.css";
import "@/styles/base.css";
import "@/styles/button.css";
import "@/styles/navbar.css";
import "@/styles/tower.css";
import "@/styles/footer.css";
import "@/styles/content-blocks.css";
import "@/styles/hero.css";
import "@/styles/accordion.css";
import "@/styles/timer.css";
import "@/styles/tooltip.css";
import "@/styles/tooltip-local.css";
import "@/styles/select.css";
import "@/styles/block-facts.css";
import "@/styles/block-partners.css";
import "@/styles/block-timeline.css";
import "@/styles/block-faq.css";
import "@/styles/block-doc.css";
import "@/styles/block-cta.css";
import "@/styles/block-countdown.css";
import "@/styles/block-divider.css";
import "@/styles/event.css";
import "@/styles/input.css";
import "@/styles/field.css";
import "@/styles/link.css";
import "@/styles/tag.css";
import "@/styles/tabs.css";
import "@/styles/segmented.css";
import "@/styles/checkbox.css";
import "@/styles/switch.css";
import "@/styles/copy-field.css";
import "@/styles/icon-button.css";
import "@/styles/modal.css";
import "@/styles/empty-state.css";
import "@/styles/banner.css";
import "@/styles/consent.css";
import "@/styles/page-header.css";
import "@/styles/challenge-tile.css";
import "@/styles/challenge-board.css";
import "@/styles/category-rail.css";
import "@/styles/challenge-modal.css";
import "@/styles/event-participant.css";
import "@/styles/event-participation.css";
import "@/styles/admin-sidebar.css";
import "@/styles/toc.css";
import "@/styles/event-manage.css";
import "@/styles/event-inbox.css";
import "@/styles/event-navbar-account.css";
import "@/styles/event-manage-brand.css";
import "@/styles/event-manage-access.css";
import "@/styles/event-action-toast.css";
import "@/styles/event-page-builder.css";
import "@/styles/rich-text-view.css";
import "@/styles/event-manage-layout.css";
import "@/styles/event-page-frame.css";
import "@/styles/join-preview.css";
import type React from "react";
import {Analytics} from "@/components/consent/Analytics";
import {GeistSans} from "geist/font/sans";
import {GeistMono} from "geist/font/mono";
import {Providers} from "@/utils/providers";
import {AppShell} from "@/components/event/AppShell";
import {EventActionToaster} from "@/components/ui/EventActionToaster";
import {headers} from "next/headers";
import {getPublicEventInfo, PublicEventError} from "@/api/publicEventInfo";
import {getGrantedEvent} from "@/api/grantedEvent";
import {loadFailure} from "@/utils/loadFailure";
import {THEME_BOOT_SCRIPT} from "@/utils/theme";
import {preload} from "react-dom";
import {EventBrandProvider, resolveEventLogoURL} from "@/components/event/EventBrandLogo";
import {FAVICON_BOOT_SCRIPT} from "@/utils/eventBrandCache";
import {getCommonManifest, readContext, RenderReadError} from "@/api/commonPage";
import {commonPageSlug} from "@/utils/commonPagePath";
import {EventReadSession} from "@/components/event/common/EventReadSession";
import {apiOrigin} from "@/utils/origins";
import {t} from "@/i18n/t";

const FALLBACK_TITLE = t("meta.brand");

export async function generateMetadata(): Promise<Metadata> {
    // Robustness: an unreachable backend (or empty response) must not crash the render of
    // every route. On any failure fall back to a static title.
    try {
        const event = (await getPublicEventInfo()) ?? (await getGrantedEvent());
        const name = event?.Name;
        if (!name || !event) {
            return {title: FALLBACK_TITLE, icons: {icon: "/platform-favicon.ico"}};
        }
        const eventUrl = `https://${(await headers()).get("host")}`
        // Title is the event name only; the platform brand goes into the description.
        const description = event.PreviewDescription?.trim() || t("meta.description", {name})
        return {
            title: name,
            description,
            icons: {icon: event.FaviconURL && apiOrigin ? `${apiOrigin}${event.FaviconURL}` : "/platform-favicon.ico"},
            openGraph: {
                title: name,
                description,
                type: "website",
                url: eventUrl,
                ...(event.PreviewPicture ? {images: [{url: event.PreviewPicture, width: 1200, height: 600, alt: name}]} : {}),
            },
        }
    } catch {
        return {title: FALLBACK_TITLE, icons: {icon: "/platform-favicon.ico"}};
    }
}



export default async function RootLayout({
                                       children,
                                   }: Readonly<{
    children: React.ReactNode;
}>) {
    const requestHeaders = await headers();
    const nonce = requestHeaders.get("x-nonce") ?? undefined;
    const serverPath = requestHeaders.get("x-event-pathname") ?? "/";
    const commonPage = commonPageSlug(serverPath);
    let privateEvent: Awaited<ReturnType<typeof getPublicEventInfo>> = null;
    let hasGrant = false;
    let expiresAt: number | undefined;
    let revision: string | null = null;
    let event: Awaited<ReturnType<typeof getPublicEventInfo>> = null;
    let unavailable = false;
    let failure: {status: number; requestId?: string} | undefined;
    try {
        event = await getPublicEventInfo();
        if (commonPage !== null) {
            const context = await readContext();
            hasGrant = !!context?.claims;
            expiresAt = context?.claims?.exp;
            const manifest = await getCommonManifest();
            if (manifest?.Audience === "staff") {privateEvent = event; event = null;}
            revision = (await getCommonManifest(commonPage))?.Revision ?? null;
        }
    } catch (error) {
        // Our backend answered with an error (it carries X-Request-ID): the 500 page. Anything else (network
        // failure, timeout, a proxy 502/503/504) is the backend being unavailable: the outage overlay.
        if ((error instanceof PublicEventError || error instanceof RenderReadError) && loadFailure(error) === "error") failure = {status: error.status, requestId: error.requestId};
        else unavailable = true;
    }
    // A personal route of a hidden event is anonymous in the public read; the staff grant still gives the branding.
    const granted = !event && !privateEvent && !unavailable && !failure ? await getGrantedEvent() : null;
    const known = event ?? privateEvent ?? granted;
    // Branding the server cannot know (a hidden event is anonymous here) stays unknown until the browser
    // loads it with the session: nothing of the platform shows meanwhile. A failed or unavailable backend
    // has no event to wait for, so it keeps the platform mark.
    const brandUnknown = !known && !unavailable && !failure;
    const logoSource = known ? resolveEventLogoURL(known.LogoURL) : null;
    // The logo is in the HTML from the first byte; the preload starts its fetch before the markup is parsed.
    if (logoSource) preload(logoSource, {as: "image"});
    const theme = known?.Theme;
    const themeStyle = theme ? {
        "--ev-brand": theme.Brand,
        "--ev-accent-light": theme.AccentLight,
        "--ev-accent-dark": theme.AccentDark,
        "--ev-accent-live": theme.AccentLive,
    } as React.CSSProperties : undefined;
    return (
        <html lang="uk" className={`${GeistSans.variable} ${GeistMono.variable}`} style={themeStyle} suppressHydrationWarning>
        <head>
            <script nonce={nonce} dangerouslySetInnerHTML={{__html: THEME_BOOT_SCRIPT}} />
            {brandUnknown && <script nonce={nonce} dangerouslySetInnerHTML={{__html: FAVICON_BOOT_SCRIPT}} />}
        </head>
        <body className="event-root">
        <Providers>
            <EventBrandProvider logoURL={brandUnknown ? null : known?.LogoURL ?? ""} faviconURL={known?.FaviconURL} name={known?.Name ?? ""} persist={!event && !!known}>
            <AppShell event={event} privateEvent={privateEvent ?? undefined} unavailable={unavailable} failure={failure}>
                {children}
            </AppShell>
            </EventBrandProvider>
            <EventReadSession hasGrant={hasGrant} expiresAt={expiresAt} serverPath={serverPath} revision={revision} publicEvent={!!event} />
            <EventActionToaster />
        </Providers>
        {/* the consent panel is always mounted («Налаштування файлів cookie»); GA loads only when configured */}
        <Analytics gaId={process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID} nonce={nonce} />
        </body>
        </html>
    );
}
