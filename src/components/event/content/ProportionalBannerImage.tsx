"use client";

import {useState} from "react";
import Image from "next/image";

export function ProportionalBannerImage({src, alt, eager = false}: {src: string; alt: string; eager?: boolean}) {
    const [ratio, setRatio] = useState(2);
    return <div className="ib-block-banner__media" style={{aspectRatio: ratio}}>
        <Image className="ib-block-banner__image" src={src} alt={alt} fill sizes="(max-width: 700px) 100vw, 1200px" unoptimized loading={eager ? "eager" : "lazy"} fetchPriority={eager ? "high" : undefined} onLoad={event => {
            const {naturalWidth, naturalHeight} = event.currentTarget;
            if (naturalWidth > 0 && naturalHeight > 0) setRatio(naturalWidth / naturalHeight);
        }} />
    </div>;
}
