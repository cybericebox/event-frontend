// @vitest-environment jsdom
import {afterEach, describe, expect, it} from "vitest";
import {cleanup, render, screen} from "@testing-library/react";
import type {ManageInAppTemplateInput} from "@/api/manageNotifications";
import {InAppPreview} from "./InAppPreview";

afterEach(cleanup);

const template: ManageInAppTemplateInput = {
    NotificationType: "participant.event.start_reminder", Title: "Скоро старт {{.event_name}}", Body: "Починаємо <strong>{{.start_at}}</strong>",
    Link: "/", Icon: "calendar", Tone: "info", AccentColor: "", Surface: "inbox", AutoDismissMs: 6000,
    Actions: [{label: "До заходу", href: "https://example.com"}], Dismissible: true,
};
const values = {event_name: "CTF 2027", start_at: "10:00"};

describe("InAppPreview", () => {
    it("draws the inbox row and the pop-in with sample values", () => {
        const {container} = render(<InAppPreview template={template} values={values} />);
        expect(screen.getAllByText("Скоро старт CTF 2027")).toHaveLength(2);
        const inbox = container.querySelector(".event-notifications__list")!;
        expect(inbox.querySelector("strong")).toBeNull();
        expect(inbox.textContent).toContain("Починаємо 10:00");
        const popIn = container.querySelector(".event-notification-popin")!;
        expect(popIn.querySelector("strong")?.textContent).toBe("10:00");
        expect(popIn.textContent).toContain("До заходу");
        expect(screen.getByText("Зникає за 6 с, якщо його не закрити.")).toBeTruthy();
    });

    it("escapes sample values and skips an unsafe button", () => {
        const {container} = render(<InAppPreview template={{...template, Actions: [{label: "Ой", href: "javascript:alert(1)"}]}} values={{...values, start_at: "<img src=x onerror=alert(1)>"}} />);
        expect(container.querySelector("img")).toBeNull();
        expect(container.querySelector(".event-notification-popin")!.textContent).not.toContain("Ой");
    });
});
