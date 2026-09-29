'use client'

import "./globals.css";
import "@/styles/tokens.css";
import "@/styles/base.css";
import "@/styles/button.css";
import "@/styles/event.css";
import {useEffect} from "react";
import {GeistSans} from "geist/font/sans";
import {GeistMono} from "geist/font/mono";
import {EventErrorScreen} from "@/components/event/EventErrorScreen";
import {applyTheme, readThemeChoice, resolveTheme} from "@/utils/theme";
import {t} from "@/i18n/t";

// Root layout failed: this replaces the whole document, so the event data and its brand
// are gone. It shows the platform style (crest, default tokens) with the saved theme.
export default function GlobalError({error, retry}: {
    error: Error & {digest?: string}
    retry: () => void
}) {
    useEffect(() => {
        // hydration keeps a server-rendered data-theme; set the saved theme after mount
        applyTheme(readThemeChoice());
        if (process.env.NODE_ENV !== "production") console.error(error);
    }, [error]);

    // React never runs inline scripts it renders on the client, so the boot script cannot
    // be reused here: the saved theme is resolved while rendering.
    const theme = typeof document === "undefined" ? undefined : resolveTheme(readThemeChoice());

    return (
        <html lang="uk" data-theme={theme} className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
        <head>
            <title>{t("error.page.title")}</title>
        </head>
        <body className="event-root" suppressHydrationWarning>
        <EventErrorScreen onRetry={retry} page />
        </body>
        </html>
    );
}
