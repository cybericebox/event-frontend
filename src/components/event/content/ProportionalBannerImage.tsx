import Image from "next/image";

// Intrinsic dimensions come from the admitted server snapshot and reserve the
// real aspect ratio while the image downloads. Unknown legacy media stays natural.
export function ProportionalBannerImage({src, alt, eager = false, dimensions}: {src: string; alt: string; eager?: boolean; dimensions?: {Width:number;Height:number}}) {
    return <div className="ib-block-banner__media">
        <Image className="ib-block-banner__image" src={src} alt={alt} width={dimensions?.Width ?? 0} height={dimensions?.Height ?? 0} sizes="(max-width: 700px) 100vw, 1200px" unoptimized loading={eager ? "eager" : "lazy"} fetchPriority={eager ? "high" : undefined} />
    </div>;
}
