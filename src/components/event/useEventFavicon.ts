"use client";

import {useEffect} from "react";
import {resolveEventLogoURL} from "@/utils/eventLogoURL";

// Manager identity is read with the API session, including for unpublished
// events. Keep its saved icon ahead of the public layout's cached metadata.
export function useEventFavicon(faviconURL: string | undefined) {
    useEffect(() => {
        if (faviconURL === undefined) return;
        const source = resolveEventLogoURL(faviconURL) ?? "/platform-favicon.ico";
        // React owns the <link rel="icon"> of the route metadata (a hoisted element it removes on navigation):
        // never remove or move those nodes, only set the attributes, or React's later removal throws.
        const apply = () => {
            const icons = [...document.head.querySelectorAll<HTMLLinkElement>('link[rel="icon"], link[rel="shortcut icon"]')];
            if (!icons.length) {
                const created = document.createElement("link");
                created.rel = "icon";
                document.head.append(created);
                icons.push(created);
            }
            for (const icon of icons) {
                if (icon.getAttribute("href") !== source) icon.setAttribute("href", source);
                const type = source === "/platform-favicon.ico" ? "image/x-icon" : "image/png";
                if (icon.type !== type) icon.type = type;
            }
        };
        apply();
        const observer = new MutationObserver(apply);
        observer.observe(document.head, {subtree: true, childList: true, attributes: true, attributeFilter: ["href", "rel"]});
        return () => observer.disconnect();
    }, [faviconURL]);
}
