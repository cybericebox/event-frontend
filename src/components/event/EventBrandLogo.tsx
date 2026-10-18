"use client";

import {createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode} from "react";
import Image from "next/image";
import crest from "@/styles/assets/crest-128.png";
import type {PublicEventInfo} from "@/types/publicEventInfo";
import {resolveEventLogoURL} from "@/utils/eventLogoURL";
import {readCachedLogo, subscribeCachedBrand, writeCachedBrand} from "@/utils/eventBrandCache";

// null = the event branding is not known yet (the server render of a hidden event is anonymous); "" = known, no logo.
const EventBrandContext = createContext<string | null>("");

const EventNameContext = createContext("");

// `name` is empty when the event is unknown or unavailable. `persist` remembers the branding for the next load
// of this host; pass false where the branding is not the event's own (outage, load failure).
export function EventBrandProvider({logoURL, faviconURL, name = "", persist = true, children}: {logoURL: string | null; faviconURL?: string; name?: string; persist?: boolean; children: ReactNode}) {
    useEffect(() => {
        if (!persist || logoURL === null) return;
        writeCachedBrand({logo: resolveEventLogoURL(logoURL) ?? "", favicon: faviconURL === undefined ? undefined : resolveEventLogoURL(faviconURL) ?? ""});
    }, [persist, logoURL, faviconURL]);
    return <EventBrandContext.Provider value={logoURL}><EventNameContext.Provider value={name}>{children}</EventNameContext.Provider></EventBrandContext.Provider>;
}

// The remembered logo is read after hydration (the server snapshot is "nothing remembered"), so the markup matches.
function useCachedLogo(): string | null {
    return useSyncExternalStore(subscribeCachedBrand, readCachedLogo, () => null);
}

// True while neither the page nor this browser knows the event's branding: nothing of the platform may show.
export function useEventBrandUnknown(): boolean {
    const inherited = useContext(EventBrandContext);
    const cached = useCachedLogo();
    return inherited === null && cached === null;
}

export function useEventBrandName(): string {
    return useContext(EventNameContext);
}

export function EventBrandLogo({event, className = "", size = 32}: {
    event?: Pick<PublicEventInfo, "LogoURL"> | null;
    className?: string;
    size?: number;
}) {
    const inheritedLogoURL = useContext(EventBrandContext);
    const cached = useCachedLogo();
    const [failedSource, setFailedSource] = useState<string | null>(null);
    // Known: the event's own value, else the inherited one. Unknown: the remembered one, else a neutral box.
    const known = event ? event.LogoURL || inheritedLogoURL || "" : inheritedLogoURL;
    const source = known === null ? (cached || null) : resolveEventLogoURL(known);
    if (known === null && cached === null) {
        return <span className={className} style={{display: "inline-block", width: size, height: size, flex: "none"}} aria-hidden="true" />;
    }
    if (source && failedSource !== source) {
        // The backend streams only the active logo reference; a deleted or
        // unreachable image falls back to the platform mark.
        // eslint-disable-next-line @next/next/no-img-element
        return <img className={className} src={source} width={size} height={size} alt="" loading="eager" onError={() => setFailedSource(source)} />;
    }
    return <Image className={className} src={crest} width={size} height={size} alt="" loading="eager" />;
}
