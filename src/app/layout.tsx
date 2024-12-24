import type {Metadata} from "next";
import "./globals.css";
import type React from "react";
import {Providers} from "@/utils/providers";
import NavBar from "@/components/navbar";
import Footer from "@/components/Footer";
import {Toaster} from "react-hot-toast";
import {headers} from "next/headers";
import {getEventInfoOnServerFn} from "@/api/serverAPI";

export async function generateMetadata(): Promise<Metadata> {
    const data = await getEventInfoOnServerFn();
    const eventUrl = `https://${(await headers()).get("subdomain")}.${process.env.NEXT_PUBLIC_DOMAIN}`
    return {
        title: data.Data.Name,
        description: `${data.Data.Name} | Cyber ICE Box Platform`,
        openGraph:{
            title: data.Data.Name,
            description: `${data.Data.Name} | Cyber ICE Box Platform`,
            type: "website",
            url: eventUrl,
            images: [
                {
                    url: data.Data.Picture || "",
                    width: 1200,
                    height: 600,
                    alt: data.Data.Name,
                }
            ],
        },
        }}



export default function RootLayout({
                                       children,
                                   }: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="uk">
        <body>
        <Providers>
            <NavBar/>
            <main>
                {children}
            </main>
            <Footer/>
            <Toaster position={"top-center"}/>
        </Providers>
        </body>
        </html>
    );
}
