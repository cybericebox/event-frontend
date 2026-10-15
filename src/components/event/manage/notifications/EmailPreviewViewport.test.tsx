// @vitest-environment jsdom
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {act, cleanup, fireEvent, render, screen} from "@testing-library/react";
import {EmailPreviewViewport} from "./EmailPreviewViewport";

let resize: ResizeObserverCallback;
let disconnect: ReturnType<typeof vi.fn>;
beforeEach(() => {
    disconnect = vi.fn();
    vi.stubGlobal("ResizeObserver", class {
        constructor(callback: ResizeObserverCallback) { resize = callback; }
        observe() {}
        disconnect = disconnect;
    });
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({width: 320, height: 480, x: 0, y: 0, top: 0, bottom: 480, left: 0, right: 320, toJSON: () => ({})});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const document = '<html><head><style>@media(max-width:400px){p{font-size:20px}}</style></head><body><p>Message and footer</p></body></html>';

describe("responsive email preview", () => {
    it("changes the actual iframe viewport without replacing the message or its sandbox", () => {
        render(<EmailPreviewViewport html={document} />);
        const iframe = screen.getByTitle("Попередній вигляд електронного листа") as HTMLIFrameElement;
        expect(screen.getByRole("group", {name: "Розмір перегляду листа"})).toBeTruthy();
        expect(iframe.style.width).toBe("1024px");
        expect(screen.getByRole("button", {name: /Компʼютер/}).getAttribute("aria-pressed")).toBe("true");
        fireEvent.click(screen.getByRole("button", {name: /Телефон/}));
        expect(iframe.style.width).toBe("390px");
        expect(iframe.getAttribute("width")).toBe("390");
        expect(screen.getByRole("button", {name: /Телефон/}).getAttribute("aria-pressed")).toBe("true");
        expect(screen.getByRole("button", {name: /Компʼютер/}).getAttribute("aria-pressed")).toBe("false");
        fireEvent.click(screen.getByRole("button", {name: /Планшет/}));
        expect(iframe.style.width).toBe("768px");
        expect(screen.getByTitle("Попередній вигляд електронного листа")).toBe(iframe);
        expect(iframe.getAttribute("srcdoc")).toBe(document);
        expect(iframe.getAttribute("sandbox")).toBe("");
    });
    it("fits narrow and resized containers while preserving each device's real layout width", () => {
        const {unmount} = render(<EmailPreviewViewport html={document} />);
        const iframe = screen.getByTitle("Попередній вигляд електронного листа") as HTMLIFrameElement;
        expect(iframe.style.transform).toBe("scale(0.3125)");
        expect(iframe.parentElement?.style.width).toBe("320px");
        expect(iframe.style.height).toBe("1536px");
        act(() => resize([{contentRect: {width: 1200, height: 560}} as ResizeObserverEntry], {} as ResizeObserver));
        expect(iframe.style.width).toBe("1024px");
        expect(iframe.style.transform).toBe("scale(1)");
        expect(iframe.parentElement?.style.width).toBe("1024px");
        unmount();
        expect(disconnect).toHaveBeenCalledOnce();
    });
    it("preserves the selected device across loading and content updates", () => {
        const {rerender} = render(<EmailPreviewViewport><div>Event loading state</div></EmailPreviewViewport>);
        fireEvent.click(screen.getByRole("button", {name: /Телефон/}));
        expect(screen.getByText("Event loading state")).toBeTruthy();
        rerender(<EmailPreviewViewport html={document} />);
        expect((screen.getByTitle("Попередній вигляд електронного листа") as HTMLIFrameElement).style.width).toBe("390px");
        rerender(<EmailPreviewViewport html="<p>Updated footer</p>" />);
        expect(screen.getByTitle("Попередній вигляд електронного листа").getAttribute("srcdoc")).toBe("<p>Updated footer</p>");
        expect(screen.getByRole("button", {name: /Телефон/}).getAttribute("aria-pressed")).toBe("true");
    });
});
