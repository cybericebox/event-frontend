"use client";

import {createContext, useContext, useState, type ReactNode} from "react";
import Image from "next/image";
import crest from "@/styles/assets/crest-128.png";
import type {PublicEventInfo} from "@/types/publicEventInfo";
import {apiOrigin} from "@/utils/origins";

export function resolveEventLogoURL(logoURL: string): string | null {
    if (!logoURL) return null;
    if (/^https:\/\//.test(logoURL)) return logoURL;
    if (!logoURL.startsWith("/api/events/")) return null;
    return apiOrigin ? `${apiOrigin}${logoURL}` : null;
}

const EventBrandContext = createContext("");

export function EventBrandProvider({logoURL, children}: {logoURL: string; children: ReactNode}) {
    return <EventBrandContext.Provider value={logoURL}>{children}</EventBrandContext.Provider>;
}

export function EventBrandLogo({event, className = "", size = 32}: {
    event?: Pick<PublicEventInfo, "LogoURL"> | null;
    className?: string;
    size?: number;
}) {
    const inheritedLogoURL = useContext(EventBrandContext);
    const source = resolveEventLogoURL(event?.LogoURL || inheritedLogoURL);
    const [failedSource, setFailedSource] = useState<string | null>(null);
    if (source && failedSource !== source) {
        // The backend streams only the active logo reference; a deleted or
        // unreachable image falls back to the platform mark.
        // eslint-disable-next-line @next/next/no-img-element
        return <img className={className} src={source} width={size} height={size} alt="" loading="eager" onError={() => setFailedSource(source)} />;
    }
    return <Image className={className} src={crest} width={size} height={size} alt="" loading="eager" />;
}
