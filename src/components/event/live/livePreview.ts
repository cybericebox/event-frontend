import type {LiveLayout} from "@/api/manageLive";

// «Перегляд» (K1): the editor renders the screen at a target resolution and
// scales it into the stage, so the preview and its text warnings match that
// screen. It changes the preview only, never the layout. A projector size
// keeps the shape being edited (a 4:3 shape at 720p is 960×720); «LED» is a
// fixed 1040×624 area with the LED text floors.
export const livePreviewKeys = ["layout", "720", "768", "1080", "led"] as const;
export type LivePreviewKey = typeof livePreviewKeys[number];

const sizes: Record<Exclude<LivePreviewKey, "layout">, {width: number; height: number}> = {
    "720": {width: 1280, height: 720}, "768": {width: 1366, height: 768}, "1080": {width: 1920, height: 1080}, led: {width: 1040, height: 624},
};

export function livePreviewLayout(view: LiveLayout, key: LivePreviewKey): LiveLayout {
    if (key === "layout") return view;
    const size = sizes[key];
    if (key === "led") return {...view, screen: {...view.screen, ...size, anchor: "top-left"}};
    const ratio = view.screen.width / view.screen.height;
    const width = Math.abs(size.width / size.height - ratio) < 0.01 ? size.width : Math.round(size.height * ratio);
    return {...view, screen: {...view.screen, width, height: size.height, anchor: "full"}};
}

// The scale of the native-size render in a stage `boxWidth` wide: the text
// keeps its real pixel sizes inside the scaled canvas.
export function livePreviewScale(boxWidth: number, screen: Pick<LiveLayout["screen"], "width">): number {
    return screen.width > 0 && boxWidth > 0 ? boxWidth / screen.width : 0;
}
