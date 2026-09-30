import Image from "next/image";

// The image sizes the banner itself (width 100%, natural height), so there is no
// guessed 2:1 box that shows through and then jumps when the image arrives.
export function ProportionalBannerImage({src, alt, eager = false}: {src: string; alt: string; eager?: boolean}) {
    return <div className="ib-block-banner__media">
        <Image className="ib-block-banner__image" src={src} alt={alt} width={0} height={0} sizes="(max-width: 700px) 100vw, 1200px" unoptimized loading={eager ? "eager" : "lazy"} fetchPriority={eager ? "high" : undefined} />
    </div>;
}
