import type {CSSProperties} from "react";
import type {ContentBlock} from "@/types/eventContent";

export type BlockLayoutProps = {
    style?: CSSProperties;
    "data-spacing"?: string;
    "data-content-align"?: ContentBlock["contentAlign"];
    "data-layout-width"?: boolean;
    "data-text-columns"?: ContentBlock["textColumns"];
    "data-mobile-full-width"?: boolean;
};

export function blockLayoutProps(block: ContentBlock): BlockLayoutProps {
    const style: Record<string, string> = {};
    const spacing: string[] = [];
    for (const device of ["desktop", "mobile"] as const) {
        for (const side of ["top", "bottom", "inline"] as const) {
            const value = block.spacing?.[device]?.[side];
            if (value !== undefined) {
                spacing.push(`${device}-${side}`);
                style[`--ib-spacing-${device}-${side}`] = `${value}px`;
            }
        }
    }
    if (block.maxWidth !== undefined) style["--ib-content-max"] = `${block.maxWidth}px`;
    return {
        style: Object.keys(style).length ? style as CSSProperties : undefined,
        "data-spacing": spacing.length ? spacing.join(" ") : undefined,
        "data-layout-width": block.maxWidth !== undefined || undefined,
        "data-content-align": block.contentAlign,
        "data-text-columns": block.type === "text" ? block.textColumns : undefined,
        "data-mobile-full-width": block.type === "banner" && block.mobileFullWidth || undefined,
    };
}
