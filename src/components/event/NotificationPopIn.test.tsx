// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, render} from "@testing-library/react";
import {NotificationPopIn, popInBodyHTML} from "./NotificationPopIn";

afterEach(cleanup);

describe("pop-in body", () => {
    it("keeps the in-app format (bold, italic, line breaks) and drops everything else", () => {
        const html = popInBodyHTML(`Старт о <strong>10:00</strong><br><em>Не спізнюйтесь</em> <a href="https://x.test">тут</a><img src=x onerror=alert(1)><span style="position:fixed">!</span>`);
        expect(html).toBe("Старт о <strong>10:00</strong><br><em>Не спізнюйтесь</em> тут!");
    });

    it("shows the participant the same formatting as the editor preview", () => {
        const {container} = render(<NotificationPopIn message={{ID: "1", Title: "Старт", Body: "Початок о <strong>10:00</strong>", Link: "", ReadAt: null, CreatedAt: "2026-10-19T10:00:00Z"}} onClose={vi.fn()} onAction={vi.fn()} />);
        expect(container.querySelector(".event-notification-popin__content strong")?.textContent).toBe("10:00");
    });
});
