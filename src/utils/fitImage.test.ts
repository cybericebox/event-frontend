import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {fitImage} from "./fitImage";

let canvases: FakeCanvas[] = [];

class FakeCanvas {
    drawn: number[] = [];
    constructor(public width: number, public height: number) { canvases.push(this); }
    getContext() {
        return {
            imageSmoothingQuality: "low",
            drawImage: (_bitmap: unknown, _x: number, _y: number, w: number, h: number) => { this.drawn = [w, h]; },
            getImageData: () => ({data: new Uint8ClampedArray([0, 0, 0, 255])}),
        };
    }
    convertToBlob({type}: {type: string}) { return Promise.resolve(new Blob(["x"], {type})); }
}

function stubBitmap(width: number, height: number) {
    vi.stubGlobal("createImageBitmap", vi.fn(async () => ({width, height, close: vi.fn()})));
}

const picture = (name: string, type: string) => new File(["pixels"], name, {type});

describe("fitImage", () => {
    beforeEach(() => { canvases = []; vi.stubGlobal("OffscreenCanvas", FakeCanvas); });
    afterEach(() => { vi.unstubAllGlobals(); });

    it("keeps a small picture untouched", async () => {
        stubBitmap(1200, 600);
        const file = picture("banner.webp", "image/webp");
        expect(await fitImage(file)).toBe(file);
        expect(canvases).toHaveLength(0);
    });

    it("shrinks a 10368 x 5184 picture to at most 4096 on the long side and 16 MP, in the same type", async () => {
        stubBitmap(10368, 5184);
        const result = await fitImage(picture("banner.webp", "image/webp"));
        const [width, height] = canvases[0].drawn;
        expect(Math.max(width, height)).toBeLessThanOrEqual(4096);
        expect(width * height).toBeLessThanOrEqual(16_000_000);
        expect(width / height).toBeCloseTo(2, 1);
        expect(result.type).toBe("image/webp");
        expect(result.name).toBe("banner.webp");
    });

    it("honours a custom pixel limit", async () => {
        stubBitmap(3000, 3000);
        await fitImage(picture("a.png", "image/png"), {maxPixels: 1_000_000, maxSide: 4096});
        const [width, height] = canvases[0].drawn;
        expect(width * height).toBeLessThanOrEqual(1_000_000);
    });

    it("falls back to jpeg and renames the file when the browser cannot encode the type", async () => {
        stubBitmap(8000, 6000);
        vi.spyOn(FakeCanvas.prototype, "convertToBlob").mockImplementation(({type}: {type: string}) => Promise.resolve(new Blob(["x"], {type: type === "image/jpeg" ? type : "image/png"})));
        const result = await fitImage(picture("photo.webp", "image/webp"));
        expect(result.type).toBe("image/jpeg");
        expect(result.name).toBe("photo.jpg");
    });

    it("leaves SVG and GIF untouched", async () => {
        stubBitmap(10368, 5184);
        const svg = picture("logo.svg", "image/svg+xml");
        const gif = picture("anim.gif", "image/gif");
        expect(await fitImage(svg)).toBe(svg);
        expect(await fitImage(gif)).toBe(gif);
        expect(canvases).toHaveLength(0);
    });

    it("returns the original file when decoding fails", async () => {
        vi.stubGlobal("createImageBitmap", vi.fn(async () => { throw new Error("bad"); }));
        const file = picture("broken.png", "image/png");
        expect(await fitImage(file)).toBe(file);
    });
});
