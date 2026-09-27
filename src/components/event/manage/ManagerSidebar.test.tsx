// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen} from "@testing-library/react";
import type {PublicEventInfo} from "@/api/publicEventInfo";
import {ManagerSidebar} from "./ManagerSidebar";

afterEach(cleanup);

const event = {
    EventID: "01900000-0000-7000-8000-000000000001", Tag: "test", Name: "Test",
    StartTime: "2026-09-28T00:00:00Z", FinishTime: null, Status: 2,
    Participation: 0, Registration: 1, CanViewResults: false, CanViewParticipants: false,
    PreviewDescription: "", PreviewPicture: "", LogoURL: "", FaviconURL: "",
    Theme: {Brand: "#211A52", Accent: "", AccentLight: "#211A52", AccentDark: "#E6E6EE", AccentLive: "#FFFFFF", Version: 1},
} satisfies PublicEventInfo;

function renderSidebar(participation: 0 | 1) {
    render(<ManagerSidebar event={{...event, Participation: participation}} pathname="/manage/participants" pages={[]} pagesError={false} canManage onRetryPages={vi.fn()} onNavigate={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", {name: "Участь"}));
}

describe("participation navigation", () => {
    it("places participation and challenges immediately after event settings", () => {
        renderSidebar(0);
        const headings = screen.getAllByRole("button", {name: /^(Подія|Участь|Завдання|Сторінки)$/});
        expect(headings.map(heading => heading.textContent?.trim())).toEqual(["Подія", "Участь", "Завдання", "Сторінки"]);
    });

    it("keeps requests inside participants and hides teams for an individual event", () => {
        renderSidebar(0);
        expect(screen.getByRole("link", {name: "Налаштування реєстрації"})).toBeTruthy();
        expect(screen.getByRole("link", {name: "Учасники"})).toBeTruthy();
        expect(screen.queryByRole("link", {name: "Заявки"})).toBeNull();
        expect(screen.queryByRole("link", {name: "Команди"})).toBeNull();
    });

    it("shows teams for a team event", () => {
        renderSidebar(1);
        expect(screen.getByRole("link", {name: "Команди"})).toBeTruthy();
    });
});
