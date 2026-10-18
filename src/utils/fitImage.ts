// Shrinks an oversized raster picture in the browser before it is uploaded, so the
// backend pixel limit (IMAGE_MAX_PIXELS) never refuses a photo or a banner. A picture
// within both limits, an SVG, a GIF (the animation would be lost) or a file the browser
// cannot decode comes back unchanged and the server gives the final answer.

export const fitImageMaxPixels = 16_000_000;
export const fitImageMaxSide = 4096;

export type FitImageOptions = {maxPixels?: number; maxSide?: number};

const lossy: Record<string, number> = {"image/jpeg": 0.9, "image/webp": 0.9};
const extension: Record<string, string> = {"image/png": "png", "image/jpeg": "jpg", "image/webp": "webp"};

type Surface = OffscreenCanvas | HTMLCanvasElement;

function makeSurface(width: number, height: number): Surface | null {
    if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(width, height);
    if (typeof document === "undefined") return null;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
}

function encode(surface: Surface, type: string): Promise<Blob | null> {
    const quality = lossy[type];
    if ("convertToBlob" in surface) return surface.convertToBlob({type, quality}).catch(() => null);
    return new Promise(resolve => surface.toBlob(resolve, type, quality));
}

function hasTransparency(surface: Surface, width: number, height: number): boolean {
    const context = surface.getContext("2d") as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
    if (!context) return false;
    const {data} = context.getImageData(0, 0, width, height);
    for (let index = 3; index < data.length; index += 4) if (data[index] < 255) return true;
    return false;
}

function renamed(name: string, type: string): string {
    const base = name.replace(/\.[^./\\]+$/, "") || "image";
    return `${base}.${extension[type]}`;
}

export async function fitImage(file: File, options: FitImageOptions = {}): Promise<File> {
    const maxPixels = options.maxPixels ?? fitImageMaxPixels;
    const maxSide = options.maxSide ?? fitImageMaxSide;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type) || typeof createImageBitmap !== "function") return file;
    let bitmap: ImageBitmap;
    try {
        bitmap = await createImageBitmap(file);
    } catch {
        return file;
    }
    try {
        const {width, height} = bitmap;
        if (width < 1 || height < 1 || (width * height <= maxPixels && Math.max(width, height) <= maxSide)) return file;
        const scale = Math.min(1, Math.sqrt(maxPixels / (width * height)), maxSide / Math.max(width, height));
        const targetWidth = Math.max(1, Math.floor(width * scale));
        const targetHeight = Math.max(1, Math.floor(height * scale));
        const surface = makeSurface(targetWidth, targetHeight);
        const context = surface?.getContext("2d") as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null | undefined;
        if (!surface || !context) return file;
        context.imageSmoothingQuality = "high";
        context.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
        let type = file.type;
        let blob = await encode(surface, type);
        if (!blob || blob.type !== type) {
            type = hasTransparency(surface, targetWidth, targetHeight) ? "image/png" : "image/jpeg";
            blob = await encode(surface, type);
        }
        if (!blob || blob.type !== type) return file;
        return new File([blob], renamed(file.name, type), {type, lastModified: file.lastModified});
    } catch {
        return file;
    } finally {
        bitmap.close?.();
    }
}
