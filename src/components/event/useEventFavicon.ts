"use client";

import {useEffect} from "react";
import {resolveEventLogoURL} from "@/utils/eventLogoURL";

// Manager identity is read with the API session, including for unpublished
// events. Keep its saved icon ahead of the public layout's cached metadata.
export function useEventFavicon(faviconURL: string | undefined) {
    useEffect(() => {
        if (faviconURL === undefined) return;
        const source = resolveEventLogoURL(faviconURL) ?? "/platform-favicon.ico";
        const apply = () => {
            const icons = [...document.head.querySelectorAll<HTMLLinkElement>('link[rel="icon"], link[rel="shortcut icon"]')];
            const icon = icons[0] ?? document.createElement("link");
            if (icon.rel !== "icon") icon.rel = "icon";
            if (icon.getAttribute("href") !== source) icon.setAttribute("href", source);
            icon.type = source === "/platform-favicon.ico" ? "image/x-icon" : "image/png";
            if (!icon.parentNode) document.head.append(icon);
            icons.slice(1).forEach(other => other.remove());
        };
        apply();
        const observer = new MutationObserver(apply);
        observer.observe(document.head, {subtree: true, childList: true, attributes: true, attributeFilter: ["href", "rel"]});
        return () => observer.disconnect();
    }, [faviconURL]);
}
