import type {Metadata} from "next";
import "./globals.css";
import type React from "react";
import {GeistSans} from "geist/font/sans";
import {GeistMono} from "geist/font/mono";
import {Providers} from "@/utils/providers";
import {AppShell} from "@/components/event/AppShell";
import {Toaster} from "react-hot-toast";
import {headers} from "next/headers";
import {getEventInfoOnServerFn} from "@/api/serverAPI";

const FALLBACK_TITLE = "Cyber ICE Box";

export async function generateMetadata(): Promise<Metadata> {
    // Robustness: an unreachable backend (or empty response) must not crash the render of
    // every route. On any failure fall back to a static title.
    try {
        const data = await getEventInfoOnServerFn();
        const name = data?.Data?.Name;
        if (!name) {
            return {title: FALLBACK_TITLE};
        }
        const eventUrl = `https://${(await headers()).get("subdomain")}.${process.env.NEXT_PUBLIC_DOMAIN}`
        return {
            title: name,
            description: `${name} | Cyber ICE Box Platform`,
            openGraph: {
                title: name,
                description: `${name} | Cyber ICE Box Platform`,
                type: "website",
                url: eventUrl,
                images: [
                    {
                        url: data.Data.Picture || "",
                        width: 1200,
                        height: 600,
                        alt: name,
                    }
                ],
            },
        }
    } catch {
        return {title: FALLBACK_TITLE};
    }
}



export default function RootLayout({
                                       children,
                                   }: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="uk" className={`${GeistSans.variable} ${GeistMono.variable}`}>
        <body>
        <Providers>
            <AppShell>
                {children}
            </AppShell>
            <Toaster position={"top-center"}/>
        </Providers>
        </body>
        </html>
    );
}
