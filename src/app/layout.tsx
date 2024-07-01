import type {Metadata} from "next";
import "./globals.css";
import type React from "react";
import {Providers} from "@/utils/providers";
import NavBar from "@/components/navbar";
import Footer from "@/components/Footer";
import {Toaster} from "react-hot-toast";
import {headers} from "next/headers";
import {getEventInfoOnServerFn} from "@/api/serverAPI";
import getEnv from "@/utils/helper";

export async function generateMetadata(): Promise<Metadata> {
    const data = await getEventInfoOnServerFn();
    const domain = getEnv("DOMAIN") || ""
    return {
        title: data.Name,
        description: `${data.Name} | Cyber ICE Box Platform`,
        openGraph:{
            title: data.Name,
            description: `${data.Name} | Cyber ICE Box Platform`,
            type: "website",
            url: `https://${headers().get("subdomain")}.${domain}`,
            images: [
                {
                    url: data.Picture || "",
                    width: 1200,
                    height: 600,
                    alt: data.Name,
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
            <Toaster/>
        </Providers>
        </body>
        </html>
    );
}
