import type {Metadata} from "next";
import "./globals.css";
import "@/styles/tokens.css";
import "@/styles/base.css";
import "@/styles/button.css";
import "@/styles/navbar.css";
import "@/styles/tower.css";
import "@/styles/footer.css";
import "@/styles/page-blocks.css";
import "@/styles/hero.css";
import "@/styles/accordion.css";
import "@/styles/timer.css";
import "@/styles/tooltip.css";
import "@/styles/select.css";
import "@/styles/block-facts.css";
import "@/styles/block-timeline.css";
import "@/styles/block-faq.css";
import "@/styles/block-doc.css";
import "@/styles/block-cta.css";
import "@/styles/block-countdown.css";
import "@/styles/block-divider.css";
import "@/styles/event.css";
import "@/styles/event-manage.css";
import type React from "react";
import {GeistSans} from "geist/font/sans";
import {GeistMono} from "geist/font/mono";
import {Providers} from "@/utils/providers";
import {AppShell} from "@/components/event/AppShell";
import {EventActionToaster} from "@/components/ui/EventActionToaster";
import {headers} from "next/headers";
import {getPublicEventInfo} from "@/api/publicEventInfo";
import {THEME_BOOT_SCRIPT} from "@/utils/theme";
import {EventBrandProvider} from "@/components/event/EventBrandLogo";

const FALLBACK_TITLE = "Cyber ICE Box";

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
        return {
            title: name,
            description: `${name} | Cyber ICE Box Platform`,
            icons: {icon: event.FaviconURL && process.env.NEXT_PUBLIC_DOMAIN ? `https://api.${process.env.NEXT_PUBLIC_DOMAIN}${event.FaviconURL}` : "/platform-favicon.ico"},
            openGraph: {
                title: name,
                description: `${name} | Cyber ICE Box Platform`,
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
            <script dangerouslySetInnerHTML={{__html: THEME_BOOT_SCRIPT}} />
            {/* The development edge caches Next's stable CSS chunk URL; this versioned asset keeps inbox styles current. */}
            {/* eslint-disable-next-line @next/next/no-css-tags -- Versioned CSS is required behind the development edge cache. */}
            <link rel="stylesheet" href="/event-inbox-v1.css" />
            {/* eslint-disable-next-line @next/next/no-css-tags -- Versioned CSS stays fresh behind the development edge cache. */}
            <link rel="stylesheet" href="/event-navbar-v3.css" />
            {/* The development edge caches Next's CSS chunk; keep new management controls current. */}
            {/* eslint-disable-next-line @next/next/no-css-tags -- Versioned CSS stays fresh behind the development edge cache. */}
            <link rel="stylesheet" href="/event-manage-brand-v13.css" />
            {/* eslint-disable-next-line @next/next/no-css-tags -- The development edge caches stable Next CSS chunk URLs. */}
            <link rel="stylesheet" href="/event-manage-access-v5.css" />
            {/* eslint-disable-next-line @next/next/no-css-tags -- Versioned CSS stays fresh behind the development edge cache. */}
            <link rel="stylesheet" href="/event-action-toast-v1.css" />
            {/* eslint-disable-next-line @next/next/no-css-tags -- Versioned CSS avoids stale constructor styles behind the development edge. */}
            <link rel="stylesheet" href="/event-page-builder-v46.css" />
        </head>
        <body className="event-root">
        <Providers>
            <EventBrandProvider logoURL={event?.LogoURL ?? ""}>
            <AppShell event={event} unavailable={unavailable}>
                {children}
            </AppShell>
            </EventBrandProvider>
            <EventActionToaster />
        </Providers>
        </body>
        </html>
    );
}
