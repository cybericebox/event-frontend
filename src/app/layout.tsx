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
import {getPublicEventInfo} from "@/api/publicEventInfo";
import {THEME_BOOT_SCRIPT} from "@/utils/theme";
import {EventBrandProvider} from "@/components/event/EventBrandLogo";
import {apiOrigin} from "@/utils/origins";
import {t} from "@/i18n/t";

const FALLBACK_TITLE = t("meta.brand");

export async function generateMetadata(): Promise<Metadata> {
    // Robustness: an unreachable backend (or empty response) must not crash the render of
    // every route. On any failure fall back to a static title.
    try {
        const event = await getPublicEventInfo();
        const name = event?.Name;
        if (!name) {
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
    const nonce = (await headers()).get("x-nonce") ?? undefined;
    let event: Awaited<ReturnType<typeof getPublicEventInfo>> = null;
    let unavailable = false;
    try {
        event = await getPublicEventInfo();
    } catch {
        unavailable = true;
    }
    const theme = event?.Theme;
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
        </head>
        <body className="event-root">
        <Providers>
            <EventBrandProvider logoURL={event?.LogoURL ?? ""} name={event?.Name ?? ""}>
            <AppShell event={event} unavailable={unavailable}>
                {children}
            </AppShell>
            </EventBrandProvider>
            <EventActionToaster />
        </Providers>
        {/* the consent panel is always mounted («Налаштування файлів cookie»); GA loads only when configured */}
        <Analytics gaId={process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID} nonce={nonce} />
        </body>
        </html>
    );
}
