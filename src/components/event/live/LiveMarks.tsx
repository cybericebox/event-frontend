"use client";

import {useState} from "react";
import {t} from "@/i18n/t";
import {liveLogoURL} from "./liveLayout";
import type {LiveMarker} from "./liveColors";

// «Позначка місць»: places 1–3 as a number, a medal circle, a medal icon, a
// cup or the organizer's own picture; other places always as a number. The
// mark sits centred in a box of one width, so places 1–3 and 4+ line up.
export function LivePlaceMark({place, marker, images}: {place: number; marker: LiveMarker; images: string[] | null}) {
    const top = place >= 1 && place <= 3;
    if (!top || marker === "numbers") return <span className="live-mark live-mark--number">{place}</span>;
    const label = t("live.place", {place});
    if (marker === "medals") return <span className={`live-mark live-mark--medal is-place-${place}`}>{place}</span>;
    if (marker === "images" && images?.[place - 1]) return <PlaceImage src={images[place - 1]} place={place} label={label} />;
    if (marker === "medal-icons") return <MedalIcon place={place} label={label} />;
    return <CupIcon place={place} label={label} />;
}

function PlaceImage({src, place, label}: {src: string; place: number; label: string}) {
    const url = liveLogoURL(src);
    // A picture that does not load leaves the cup in its place.
    const [broken, setBroken] = useState(false);
    if (!url || broken) return <CupIcon place={place} label={label} />;
    // eslint-disable-next-line @next/next/no-img-element
    return <span className={`live-mark live-mark--image is-place-${place}`}><img src={url} alt={label} onError={() => setBroken(true)} /></span>;
}

function MedalIcon({place, label}: {place: number; label: string}) {
    return <span className={`live-mark live-mark--icon is-place-${place}`} role="img" aria-label={label}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path className="live-mark__ribbon-a" d="M7 1h4l2 6H9z" /><path className="live-mark__ribbon-b" d="M13 1h4l-2 6h-4z" />
            <circle className="live-mark__fill" cx="12" cy="15" r="7.5" />
            <text x="12" y="18.2" textAnchor="middle">{place}</text>
        </svg>
    </span>;
}

function CupIcon({place, label}: {place: number; label: string}) {
    return <span className={`live-mark live-mark--icon is-place-${place}`} role="img" aria-label={label}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path className="live-mark__fill" d="M6 3h12v2h3v3a4 4 0 0 1-4 4h-.3A5 5 0 0 1 13 14.9V18h3v3H8v-3h3v-3.1A5 5 0 0 1 7.3 12H7a4 4 0 0 1-4-4V5h3V3Zm0 4H5v1a2 2 0 0 0 1 1.7V7Zm12 0v2.7A2 2 0 0 0 19 8V7h-1Z" />
        </svg>
    </span>;
}
